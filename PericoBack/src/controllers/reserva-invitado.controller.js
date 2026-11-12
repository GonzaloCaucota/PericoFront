const { randomBytes, createHash } = require('node:crypto');
const { sequelize, Invitado, Reserva, Viaje, Auto } = require('../models/relaciones');
const hash = token => createHash('sha256').update(token).digest('hex');
const fallo = (status, mensaje) => Object.assign(new Error(mensaje), { status });
const resumen = r => ({ idReserva: r.idReserva, idViaje: r.idViaje, cantidadAsientos: r.cantidadAsientos, importeTotal: r.importeTotal, estadoReserva: r.estadoReserva, estadoPago: r.estadoPago, horarioEncuentro: r.horarioEncuentro, encuentroConfirmadoAt: r.encuentroConfirmadoAt, noPresentadoAt: r.noPresentadoAt, toleranciaEncuentroMinutos: r.toleranciaEncuentroMinutos });
exports.crear = async (req, res, next) => {
  try {
    const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
    const telefono = typeof req.body.telefono === 'string' ? req.body.telefono.trim() : '';
    const cantidad = Number(req.body.cantidadAsientos), idViaje = Number(req.body.idViaje);
    if (nombre.length < 2 || nombre.length > 100 || !/^[+\d ()-]{7,20}$/.test(telefono) || telefono.replace(/\D/g, '').length < 7 || !Number.isSafeInteger(cantidad) || cantidad < 1 || !Number.isSafeInteger(idViaje) || idViaje < 1) throw fallo(400, 'Completa nombre, telefono valido y cantidad de asientos.');
    const token = randomBytes(32).toString('hex');
    const { reserva, viaje } = await sequelize.transaction(async transaction => {
      const viaje = await Viaje.findByPk(idViaje, { transaction, lock: { level: 'UPDATE', of: Viaje } });
      if (!viaje) throw fallo(404, 'Viaje no encontrado.');
      const [[fecha]] = await sequelize.query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Jujuy')::date::text AS hoy", { transaction });
      const auto = await Auto.findByPk(viaje.idAuto, { transaction });
      if (!['ABIERTO', 'EN_CURSO'].includes(viaje.estadoViaje) || viaje.fechaSalida < fecha.hoy || !viaje.recorrido?.activo || !['DISPONIBLE', 'EN_VIAJE'].includes(auto?.estado) || !(await require('../services/cuenta-habilitada').choferAprobado(viaje.idChofer))) throw fallo(400, 'Este viaje ya no esta disponible.');
      if (viaje.asientosDisponibles < cantidad) throw fallo(409, 'No hay suficientes asientos disponibles.');
      const invitado = await Invitado.create({ nombre, telefono, tokenHash: hash(token) }, { transaction });
      const reserva = await Reserva.create({ idViaje, idInvitado: invitado.idInvitado, idPasajero: null, cantidadAsientos: cantidad, importeTotal: (Number(viaje.tarifaPorAsiento) * cantidad).toFixed(2), estadoReserva: 'PENDIENTE', estadoPago: 'PENDIENTE' }, { transaction });
      viaje.asientosDisponibles -= cantidad;
      await viaje.save({ transaction });
      return { reserva, viaje };
    });
    req.io?.emit(`reserva_creada_viaje_${viaje.idViaje}`, { idViaje: viaje.idViaje, idReserva: reserva.idReserva, reserva });
    req.io?.emit(`asientos_actualizados_viaje_${viaje.idViaje}`, { idViaje: viaje.idViaje, asientosDisponibles: viaje.asientosDisponibles, viaje });
    res.status(201).json({ reserva: resumen(reserva), token, tipoPago: 'EFECTIVO' });
  } catch (error) { if (error.status) return res.status(error.status).json({ mensaje: error.message }); next(error); }
};
exports.gestionar = cancelar => async (req, res, next) => {
  try {
    const token = req.headers['x-reserva-token'];
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw fallo(401, 'Comprobante no valido.');
    const resultado = await sequelize.transaction(async transaction => {
      const invitado = await Invitado.findOne({ where: { tokenHash: hash(token) }, transaction });
      if (!invitado) throw fallo(401, 'Comprobante no valido.');
      // Tomar siempre viaje antes de reserva, como el flujo de creacion.
      const original = await Reserva.findOne({ where: { idInvitado: invitado.idInvitado }, transaction });
      if (!original) throw fallo(404, 'Reserva no encontrada.');
      const viaje = await Viaje.findByPk(original.idViaje, { transaction, lock: { level: 'UPDATE', of: Viaje } });
      const reserva = await Reserva.findByPk(original.idReserva, { transaction, lock: true });
      if (cancelar && reserva.estadoReserva !== 'CANCELADA') {
        if (!['PENDIENTE', 'CONFIRMADA'].includes(reserva.estadoReserva) || !['ABIERTO', 'COMPLETO'].includes(viaje.estadoViaje) || reserva.estadoPago !== 'PENDIENTE') throw fallo(409, 'La reserva ya no admite cancelacion por la web. Contacta al chofer.');
        reserva.estadoReserva = 'CANCELADA';
        viaje.asientosDisponibles += reserva.cantidadAsientos;
        if (viaje.estadoViaje === 'COMPLETO') viaje.estadoViaje = 'ABIERTO';
        await reserva.save({ transaction }); await viaje.save({ transaction });
      }
      return { reserva, viaje, invitado };
    });
    if (cancelar) {
      req.io?.emit(`reserva_cancelada_${resultado.reserva.idReserva}`, { idReserva: resultado.reserva.idReserva, idViaje: resultado.viaje.idViaje, reserva: resultado.reserva });
      req.io?.emit(`asientos_actualizados_viaje_${resultado.viaje.idViaje}`, { idViaje: resultado.viaje.idViaje, asientosDisponibles: resultado.viaje.asientosDisponibles, viaje: resultado.viaje });
    }
    const ubicacion = resultado.invitado.latitud != null && resultado.invitado.longitud != null
      ? { latitud: Number(resultado.invitado.latitud), longitud: Number(resultado.invitado.longitud), precision: resultado.invitado.precision != null ? Number(resultado.invitado.precision) : null, actualizadaAt: resultado.invitado.ubicacionActualizadaAt }
      : null;
    res.json({ reserva: resumen(resultado.reserva), viaje: { origen: resultado.viaje.origen, destino: resultado.viaje.destino, fechaSalida: resultado.viaje.fechaSalida, horaSalida: resultado.viaje.horaSalida }, ubicacion });
  } catch (error) { if (error.status) return res.status(error.status).json({ mensaje: error.message }); next(error); }
};

// El comprobante da acceso solo a la ubicacion del titular de esta reserva.
exports.ubicacion = async (req, res, next) => {
  try {
    const token = req.headers['x-reserva-token'];
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw fallo(401, 'Comprobante no valido.');
    const borrar = req.body.compartir === false;
    const latitud = Number(req.body.latitud);
    const longitud = Number(req.body.longitud);
    const precisionRaw = req.body.precision === undefined || req.body.precision === null ? 0 : Number(req.body.precision);
    const precision = Number.isFinite(precisionRaw) ? Math.min(precisionRaw, 99999999) : NaN;
    if (!borrar && (req.body.compartir !== true || ![latitud, longitud, precision].every(v => Number.isFinite(v)) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180 || precision < 0)) throw fallo(400, 'Ubicacion no valida.');
    const resultado = await sequelize.transaction(async transaction => {
      const invitado = await Invitado.findOne({ where: { tokenHash: hash(token) }, transaction });
      if (!invitado) throw fallo(401, 'Comprobante no valido.');
      const reserva = await Reserva.findOne({ where: { idInvitado: invitado.idInvitado }, transaction });
      if (!reserva) throw fallo(404, 'Reserva no encontrada.');
      const viaje = await Viaje.findByPk(reserva.idViaje, { transaction, lock: { level: 'UPDATE', of: Viaje } });
      await reserva.reload({ transaction });
      if (!borrar && (!['PENDIENTE', 'CONFIRMADA'].includes(reserva.estadoReserva) || !['ABIERTO', 'COMPLETO', 'EN_CURSO'].includes(viaje.estadoViaje))) throw fallo(409, 'Solo puedes compartir ubicacion con una reserva activa.');
      await invitado.update({ latitud: borrar ? null : latitud, longitud: borrar ? null : longitud, precision: borrar ? null : precision, ubicacionActualizadaAt: borrar ? null : new Date() }, { transaction });
      return { reserva, invitado };
    });
    req.io?.emit(`ubicacion_invitado_viaje_${resultado.reserva.idViaje}`, { idViaje: resultado.reserva.idViaje, idReserva: resultado.reserva.idReserva });
    return res.json({ compartiendo: !borrar, ubicacion: borrar ? null : { latitud: resultado.invitado.latitud, longitud: resultado.invitado.longitud, precision: resultado.invitado.precision, actualizadaAt: resultado.invitado.ubicacionActualizadaAt } });
  } catch (error) { if (error.status) return res.status(error.status).json({ mensaje: error.message }); next(error); }
};
