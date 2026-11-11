const { sequelize, Reserva, Viaje, Pasajero } = require('../models/relaciones');

const reservaCtrl = {};

const estadosReservaValidos = [
  'PENDIENTE',
  'CONFIRMADA',
  'CANCELADA',
  'UTILIZADA',
  'NO_PRESENTADO',
];

const cancelarReservaConTransaccion = async (idReserva, transaction) => {
  // Cancelar una reserva devuelve los asientos al viaje dentro de la misma transaccion.
  const reserva = await Reserva.findByPk(idReserva, {
    transaction,
    lock: true,
  });

  if (!reserva) {
    return { error: { status: 404, body: { mensaje: 'Reserva no encontrada' } } };
  }

  if (!['PENDIENTE', 'CONFIRMADA'].includes(reserva.estadoReserva)) {
    return { error: { status: 400, body: { mensaje: 'La reserva ya se encuentra cancelada' } } };
  }

  const viaje = await Viaje.findByPk(reserva.idViaje, {
    transaction,
    lock: { level: 'UPDATE', of: Viaje },
  });

  if (!viaje) {
    return { error: { status: 404, body: { mensaje: 'Viaje de la reserva no encontrado' } } };
  }

  // Al cancelar se devuelven al viaje los asientos que tenia tomada la reserva.
  reserva.estadoReserva = 'CANCELADA';
  viaje.asientosDisponibles += reserva.cantidadAsientos;
  if (viaje.estadoViaje === 'COMPLETO') viaje.estadoViaje = 'ABIERTO';

  await reserva.save({ transaction });
  await viaje.save({ transaction });

  return { reserva, viaje };
};

const emitirReservaCreada = (req, reserva) => {
  // Eventos usados para que el chofer y el listado del pasajero se actualicen sin recargar.
  if (!req.io) return;

  req.io.emit(`reserva_creada_viaje_${reserva.idViaje}`, {
    idReserva: reserva.idReserva,
    idViaje: reserva.idViaje,
    reserva,
  });
};

const emitirReservaCancelada = (req, reserva, viaje) => {
  if (!req.io) return;

  req.io.emit(`reserva_cancelada_${reserva.idReserva}`, {
    idReserva: reserva.idReserva,
    idViaje: reserva.idViaje,
    reserva,
    viaje,
  });

  req.io.emit(`asientos_actualizados_viaje_${viaje.idViaje}`, {
    idViaje: viaje.idViaje,
    asientosDisponibles: viaje.asientosDisponibles,
    viaje,
  });
};

reservaCtrl.registrarReserva = async (req, res) => {
  /*
    #swagger.tags = ['Reservas']
    #swagger.summary = 'Crear reserva con pago en efectivo'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/Reserva' } }
    #swagger.responses[201] = { description: 'Reserva creada, pendiente de pago en efectivo.' }
  */
  try {
    const transaction = await sequelize.transaction();
    let reserva;
    let viaje;

    try {
      const cantidadSolicitada = Number(req.body.cantidadAsientos);
      if (!Number.isSafeInteger(cantidadSolicitada) || cantidadSolicitada <= 0) {
        await transaction.rollback();
        return res.status(400).json({ mensaje: 'Cantidad de asientos invalida' });
      }
      const pasajero = await Pasajero.findByPk(req.body.idPasajero, { transaction });
      if (!pasajero || pasajero.estadoPasajero !== 'ACTIVO' || (req.usuario.rol !== 'ADMIN' && pasajero.idUsuario !== req.usuario.idUsuario)) {
        await transaction.rollback();
        return res.status(403).json({ mensaje: 'Pasajero no autorizado' });
      }

      viaje = await Viaje.findByPk(req.body.idViaje, {
        transaction,
        lock: { level: 'UPDATE', of: Viaje },
      });

      if (!viaje) {
        await transaction.rollback();
        return res.status(404).json({
          mensaje: 'Viaje no encontrado',
        });
      }

      if (!(await require('../services/cuenta-habilitada').choferAprobado(viaje.idChofer))) {
        await transaction.rollback();
        return res.status(403).json({ mensaje: 'El chofer de este viaje no esta habilitado.' });
      }

      // Se permite reservar un viaje publicado o ya iniciado si todavia quedan asientos.
      if (!['ABIERTO', 'EN_CURSO'].includes(viaje.estadoViaje)) {
        await transaction.rollback();
        return res.status(400).json({
          mensaje: 'El viaje no esta disponible para reservas',
        });
      }

      if (viaje.asientosDisponibles < cantidadSolicitada) {
        await transaction.rollback();
        return res.status(400).json({
          mensaje: 'No hay suficientes asientos disponibles',
        });
      }

      // Crear reserva y descontar asientos debe ser atomico para evitar sobreventa.
      reserva = await Reserva.create({
        idViaje: viaje.idViaje,
        idPasajero: pasajero.idPasajero,
        cantidadAsientos: cantidadSolicitada,
        importeTotal: (Number(viaje.tarifaPorAsiento) * cantidadSolicitada).toFixed(2),
        estadoReserva: 'PENDIENTE',
        estadoPago: 'PENDIENTE',
      }, { transaction });
      viaje.asientosDisponibles -= cantidadSolicitada;
      await viaje.save({ transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      return res.status(400).json({
        mensaje: 'Error al crear reserva',
        error: error.message,
      });
    }

    if (req.io) {
      req.io.emit(`asientos_actualizados_viaje_${viaje.idViaje}`, {
        idViaje: viaje.idViaje,
        asientosDisponibles: viaje.asientosDisponibles,
        viaje,
      });
    }

    emitirReservaCreada(req, reserva);
    return res.status(201).json({
      mensaje: 'Reserva creada con éxito para pago en efectivo',
      reserva,
      asientosDisponibles: viaje.asientosDisponibles,
      tipoPago: 'EFECTIVO'
    });
  } catch (error) {
    return res.status(400).json({ mensaje: 'Error al crear reserva', error: error.message });
  }
};

reservaCtrl.registrarPagoEfectivo = async (req, res) => {
  /*
    #swagger.tags = ['Reservas']
    #swagger.summary = 'Registrar pago en efectivo'
    #swagger.description = 'Lo hace el CHOFER al recibir el pago, o ADMIN.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['idReserva'] = { in: 'path', required: true, type: 'integer', description: 'ID de la reserva.' }
    #swagger.responses[200] = { description: 'Pago en efectivo registrado con éxito.' }
    #swagger.responses[400] = { description: 'La reserva ya figura como PAGADA.' }
    #swagger.responses[404] = { description: 'Reserva no encontrada.' }
  */
  try {
    const { idReserva } = req.params; 

    const reserva = await Reserva.findByPk(idReserva);

    if (!reserva) {
      return res.status(404).json({
        mensaje: 'Error de búsqueda',
        error: `No se encontró ninguna reserva con el ID #${idReserva}`
      });
    }

    if (reserva.estadoPago === 'PAGADO') {  // Validacion  que no se intente marcar como pagado algo que YA está pagado
      return res.status(400).json({
        mensaje: 'Validación de pago fallida',
        error: 'Esta reserva ya figura como PAGADA en el sistema.'
      });
    }

    if (reserva.estadoReserva === 'CANCELADA') return res.status(400).json({ mensaje: 'Reserva cancelada' });

    // El chofer registra el efectivo recibido y notifica a los participantes.
    reserva.estadoPago = 'PAGADO';
    if (reserva.estadoReserva === 'PENDIENTE') {
      reserva.estadoReserva = 'CONFIRMADA';
    }
    await reserva.save();
    req.io.emit(`pago_confirmado_reserva_${reserva.idReserva}`, {
      idReserva: reserva.idReserva,
      idViaje: reserva.idViaje,
      idPasajero: reserva.idPasajero,
      estadoPago: reserva.estadoPago,
      estadoReserva: reserva.estadoReserva,
      tipoPago: 'EFECTIVO'
    });
    req.io.emit(`reserva_actualizada_${reserva.idReserva}`, {
      idReserva: reserva.idReserva,
      idViaje: reserva.idViaje,
      idPasajero: reserva.idPasajero,
      estadoReserva: reserva.estadoReserva,
      estadoPago: reserva.estadoPago
    });
    req.io.emit(`pago_actualizado_viaje_${reserva.idViaje}`, {
      idReserva: reserva.idReserva,
      idViaje: reserva.idViaje,
      idPasajero: reserva.idPasajero,
      estadoPago: reserva.estadoPago,
      estadoReserva: reserva.estadoReserva,
      tipoPago: 'EFECTIVO'
    });
    return res.status(200).json({
      mensaje: 'El pago en efectivo fue registrado con éxito por el chofer',
      idReserva: reserva.idReserva,
      estadoPago: reserva.estadoPago,
      estadoReserva: reserva.estadoReserva,
    });

  } catch (error) {
    res.status(500).json({
      mensaje: 'Error al registrar el pago en efectivo',
      error: error.message
    });
  }
};



reservaCtrl.obtenerReservas = async (req, res) => {
  /*
    #swagger.tags = ['Reservas']
    #swagger.summary = 'Obtener todas las reservas'
    #swagger.description = 'Requiere rol ADMIN. Incluye pasajero, viaje, chofer y auto.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = { description: 'Lista de reservas.', schema: [{ $ref: '#/definitions/Reserva' }] }
  */
  try {
    const reservas = await Reserva.findAll({
      include: [
        'invitado',
        {
          association: 'pasajero',
          include: ['usuario']
        },
        {
          association: 'viaje',
          include: ['chofer', 'auto']
        }
      ]
    });

    res.status(200).json(reservas);
  } catch (error) {
    res.status(500).json({
      mensaje: 'Error al obtener reservas',
      error: error.message
    });
  }
};


reservaCtrl.cambiarEstadoReserva = async (req, res) => {
  /*
    #swagger.tags = ['Reservas']
    #swagger.summary = 'Cambiar estado de una reserva'
    #swagger.description = "Estados válidos: PENDIENTE, CONFIRMADA, CANCELADA, UTILIZADA, NO_PRESENTADO. Si es CANCELADA, devuelve los asientos al viaje. Requiere rol ADMIN o CHOFER."
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['idReserva'] = { in: 'path', required: true, type: 'integer', description: 'ID de la reserva.' }
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { estado: 'CONFIRMADA' } }
    #swagger.responses[200] = { description: 'Estado de reserva actualizado correctamente.' }
    #swagger.responses[400] = { description: 'Estado de reserva no valido.' }
    #swagger.responses[404] = { description: 'Reserva no encontrada.' }
  */
  const estado = req.body.estado || req.body.estadoReserva;

  if (!estadosReservaValidos.includes(estado)) {
    return res.status(400).json({
      mensaje: 'Estado de reserva no valido',
      estadosValidos: estadosReservaValidos,
    });
  }

  const transaction = await sequelize.transaction();

  try {
    if (estado === 'CANCELADA') {
      const resultado = await cancelarReservaConTransaccion(req.params.idReserva, transaction);

      if (resultado.error) {
        await transaction.rollback();
        return res.status(resultado.error.status).json(resultado.error.body);
      }

      await transaction.commit();
      emitirReservaCancelada(req, resultado.reserva, resultado.viaje);

      return res.status(200).json({
        mensaje: 'Reserva cancelada correctamente y asientos devueltos al viaje',
        reserva: resultado.reserva,
        viaje: resultado.viaje,
      });
    }

    const reserva = await Reserva.findByPk(req.params.idReserva, { transaction });
    if (!reserva) {
      await transaction.rollback();
      return res.status(404).json({
        mensaje: 'Reserva no encontrada',
      });
    }

    if (!['PENDIENTE', 'CONFIRMADA'].includes(reserva.estadoReserva) || estado === 'PENDIENTE') {
      await transaction.rollback();
      return res.status(400).json({ mensaje: 'Transicion de reserva no permitida' });
    }
    reserva.estadoReserva = estado;
    await reserva.save({ transaction });
    await transaction.commit();

    req.io?.emit(`reserva_actualizada_${reserva.idReserva}`, {
      idReserva: reserva.idReserva,
      idViaje: reserva.idViaje,
      idPasajero: reserva.idPasajero,
      estadoReserva: reserva.estadoReserva,
      estadoPago: reserva.estadoPago,
      reserva,
    });

    return res.status(200).json({
      mensaje: 'Estado de reserva actualizado correctamente',
      reserva,
    });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      mensaje: 'Error al cambiar el estado de la reserva',
      error: error.message,
    });
  }
};


reservaCtrl.cancelarReserva = async (req, res) => {
  /*
    #swagger.tags = ['Reservas']
    #swagger.summary = 'Cancelar una reserva'
    #swagger.description = 'Requiere rol ADMIN o el PASAJERO dueño de la reserva. Devuelve los asientos al viaje.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['idReserva'] = { in: 'path', required: true, type: 'integer', description: 'ID de la reserva.' }
    #swagger.responses[200] = { description: 'Reserva cancelada correctamente y asientos devueltos al viaje.' }
    #swagger.responses[403] = { description: 'No tenes permiso para cancelar esta reserva.' }
    #swagger.responses[404] = { description: 'Reserva no encontrada.' }
  */
  const transaction = await sequelize.transaction();

  try {
     // Solo puede cancelar: un ADMIN, o el pasajero dueno de la reserva.
    if (req.usuario.rol !== 'ADMIN') {
      const reservaExistente = await Reserva.findByPk(req.params.idReserva, { transaction });
      if (!reservaExistente) {
        await transaction.rollback();
        return res.status(404).json({ mensaje: 'Reserva no encontrada' });
      }

      const pasajero = await Pasajero.findByPk(reservaExistente.idPasajero, { transaction });
      if (!pasajero || pasajero.idUsuario !== req.usuario.idUsuario) {
        await transaction.rollback();
        return res.status(403).json({ mensaje: 'No tenes permiso para cancelar esta reserva' });
      }
    }
    const resultado = await cancelarReservaConTransaccion(req.params.idReserva, transaction);

    if (resultado.error) {
      await transaction.rollback();
      return res.status(resultado.error.status).json(resultado.error.body);
    }

    await transaction.commit();
    emitirReservaCancelada(req, resultado.reserva, resultado.viaje);

    return res.status(200).json({
      mensaje: 'Reserva cancelada correctamente y asientos devueltos al viaje',
      reserva: resultado.reserva,
      viaje: resultado.viaje,
    });

  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      mensaje: 'Error al cancelar la reserva',
      error: error.message,
    });
  }
};

module.exports = reservaCtrl;
