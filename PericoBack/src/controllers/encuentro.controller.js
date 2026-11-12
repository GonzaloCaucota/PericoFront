const { createHash } = require('node:crypto');
const { sequelize, Reserva, Viaje, Chofer, Pasajero, Invitado, Auto } = require('../models/relaciones');
const { toleranciaEncuentroMinutos } = require('../services/politica-encuentro');
const fallo = (status, message) => Object.assign(new Error(message), { status });
const resumen = r => ({ idReserva: r.idReserva, estadoReserva: r.estadoReserva, horarioEncuentro: r.horarioEncuentro,
  encuentroConfirmadoAt: r.encuentroConfirmadoAt, noPresentadoAt: r.noPresentadoAt, toleranciaEncuentroMinutos });
exports.gestionar = (accion, invitado = false) => async (req, res, next) => {
  try {
    const resultado = await sequelize.transaction(async transaction => {
      let original;
      if (invitado) {
        const token = req.headers['x-reserva-token'];
        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw fallo(401, 'Comprobante no valido.');
        const titular = await Invitado.findOne({ where: { tokenHash: createHash('sha256').update(token).digest('hex') }, transaction });
        if (!titular) throw fallo(401, 'Comprobante no valido.');
        original = await Reserva.findOne({ where: { idInvitado: titular.idInvitado }, transaction });
      } else original = await Reserva.findByPk(req.params.idReserva, { transaction });
      if (!original) throw fallo(404, 'Reserva no encontrada.');
      // Mismo orden que las altas: viaje primero, reserva despues.
      const viaje = await Viaje.findByPk(original.idViaje, { transaction, lock: { level: 'UPDATE', of: Viaje } });
      if (!viaje) throw fallo(404, 'Viaje no encontrado.');
      const reserva = await Reserva.findByPk(original.idReserva, { transaction, lock: true });
      if (!invitado) {
        if (accion === 'confirmar') {
          const pasajero = reserva.idPasajero && await Pasajero.findByPk(reserva.idPasajero, { transaction });
          if (req.usuario.rol !== 'PASAJERO' || pasajero?.idUsuario !== req.usuario.idUsuario) throw fallo(403, 'Solo el pasajero titular puede confirmar el horario.');
        } else {
          const chofer = await Chofer.findByPk(viaje.idChofer, { transaction });
          if (req.usuario.rol !== 'ADMIN' && (req.usuario.rol !== 'CHOFER' || chofer?.idUsuario !== req.usuario.idUsuario)) throw fallo(403, 'No tenes permiso sobre esta reserva.');
        }
      }
      if (accion === 'ausencia' && reserva.estadoReserva === 'NO_PRESENTADO') return { reserva, viaje, cambiado: false };
      if (!['PENDIENTE', 'CONFIRMADA'].includes(reserva.estadoReserva) || !['ABIERTO', 'COMPLETO', 'EN_CURSO'].includes(viaje.estadoViaje)) throw fallo(409, 'La reserva o el viaje ya no estan activos.');
      const [[reloj]] = await sequelize.query('SELECT CURRENT_TIMESTAMP AS ahora', { transaction });
      const ahora = new Date(reloj.ahora);
      if (accion === 'proponer') {
        const horario = typeof req.body.horarioEncuentro === 'string' ? new Date(req.body.horarioEncuentro) : new Date(NaN);
        if (!Number.isFinite(horario.getTime()) || !/(Z|[+-]\d{2}:\d{2})$/.test(req.body.horarioEncuentro) || horario <= ahora) throw fallo(400, 'Propone una fecha y hora futura con zona horaria.');
        if (horario.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Jujuy' }) !== viaje.fechaSalida) throw fallo(400, 'El encuentro debe ser en la fecha del viaje, en horario de Jujuy.');
        reserva.horarioEncuentro = horario;
        reserva.encuentroConfirmadoAt = null;
      } else if (accion === 'confirmar') {
        const horario = new Date(req.body.horarioEncuentro);
        if (!reserva.horarioEncuentro || !Number.isFinite(horario.getTime()) || horario.getTime() !== new Date(reserva.horarioEncuentro).getTime()) throw fallo(409, 'El horario cambio. Consulta la reserva antes de confirmar.');
        if (reserva.encuentroConfirmadoAt) return { reserva, viaje, cambiado: false };
        if (horario <= ahora) throw fallo(409, 'El horario ya paso. Pedi al chofer una nueva propuesta.');
        reserva.encuentroConfirmadoAt = ahora;
      } else if (accion === 'ausencia') {
        if (!reserva.horarioEncuentro || !reserva.encuentroConfirmadoAt) throw fallo(409, 'El pasajero debe confirmar el horario antes de poder registrar su ausencia.');
        if (ahora.getTime() < new Date(reserva.horarioEncuentro).getTime() + toleranciaEncuentroMinutos * 60000) throw fallo(409, 'Todavia no pasaron los 10 minutos de tolerancia del horario acordado.');
        if (reserva.estadoPago !== 'PENDIENTE') throw fallo(409, 'La reserva tiene un pago registrado. Contacta a administracion para resolverlo.');
        const auto = await Auto.findByPk(viaje.idAuto, { transaction });
        const libres = Number(viaje.asientosDisponibles) + Number(reserva.cantidadAsientos);
        if (!auto || libres > auto.capacidadAsientos) throw fallo(409, 'La disponibilidad requiere revision antes de liberar la reserva.');
        reserva.estadoReserva = 'NO_PRESENTADO';
        reserva.noPresentadoAt = ahora;
        reserva.noPresentadoPor = req.usuario.idUsuario;
        viaje.asientosDisponibles = libres;
        if (viaje.estadoViaje === 'COMPLETO') viaje.estadoViaje = 'ABIERTO';
        await viaje.save({ transaction });
      } else throw fallo(400, 'Accion no valida.');
      await reserva.save({ transaction });
      return { reserva, viaje, cambiado: true };
    });
    if (resultado.cambiado) {
      req.io?.emit(`reserva_actualizada_${resultado.reserva.idReserva}`, {
        ...resumen(resultado.reserva), idViaje: resultado.viaje.idViaje, reserva: resultado.reserva
      });
      if (accion === 'ausencia') req.io?.emit(`asientos_actualizados_viaje_${resultado.viaje.idViaje}`, {
        idViaje: resultado.viaje.idViaje, asientosDisponibles: resultado.viaje.asientosDisponibles
      });
    }
    return res.json({ reserva: resumen(resultado.reserva), asientosDisponibles: resultado.viaje.asientosDisponibles });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ mensaje: error.message });
    next(error);
  }
};
