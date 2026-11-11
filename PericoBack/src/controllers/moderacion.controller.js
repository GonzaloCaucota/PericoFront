const { Op } = require('sequelize');
const { sequelize, Usuario, Chofer, Pasajero, Admin, HabilitacionChofer, Auto, Viaje, Reserva } = require('../models/relaciones');

exports.chofer = accion => async (req, res) => {
  const motivo = String(req.body.motivo || '').trim();
  if (accion === 'bloquear' && motivo.length < 5) return res.status(400).json({ mensaje: 'Indica un motivo de al menos 5 caracteres.' });
  let idUsuario;
  const eventos = [];
  try {
    await sequelize.transaction(async transaction => {
      const administrador = await Admin.findOne({ where: { idUsuario: req.usuario.idUsuario }, transaction });
      const chofer = await Chofer.findByPk(req.params.idChofer, { transaction, lock: true });
      if (!chofer) throw Object.assign(new Error('Chofer no encontrado'), { status: 404 });
      idUsuario = chofer.idUsuario;
      const usuario = await Usuario.findByPk(idUsuario, { transaction, lock: true });
      const habilitacion = await HabilitacionChofer.findByPk(chofer.idChofer, { transaction, lock: true });
      if (accion === 'aprobar') {
        if (habilitacion.estado === 'APROBADO' && usuario.activo && ['DISPONIBLE', 'DESCANSO', 'EN_VIAJE'].includes(chofer.estadoChofer)) return;
        habilitacion.estado = 'APROBADO';
        habilitacion.idAdmin = administrador.idAdmin;
        habilitacion.fechaDecision = new Date();
        habilitacion.motivo = motivo || 'Alta aprobada por administracion';
        chofer.estadoChofer = 'DISPONIBLE';
        usuario.activo = true;
      } else {
        chofer.estadoChofer = 'SUSPENDIDO';
        usuario.activo = false;
        const viajes = await Viaje.unscoped().findAll({ where: { idChofer: chofer.idChofer, estadoViaje: { [Op.in]: ['ABIERTO', 'COMPLETO', 'EN_CURSO'] } }, transaction, lock: true });
        for (const viaje of viajes) {
          viaje.estadoViaje = 'CANCELADO';
          await viaje.save({ transaction });
          await Reserva.update({ estadoReserva: 'CANCELADA' }, { where: { idViaje: viaje.idViaje, estadoReserva: { [Op.in]: ['PENDIENTE', 'CONFIRMADA'] } }, transaction, individualHooks: true });
          eventos.push({ idViaje: viaje.idViaje, estadoViaje: 'CANCELADO' });
        }
      }
      await usuario.save({ transaction });
      await chofer.save({ transaction });
      await habilitacion.save({ transaction });
      // Motivo y actor tambien se conservan cuando el estado ya coincidia.
      await require('../models/relaciones').Auditoria.create({ tablaAfectada: 'ModeracionChofer', accion: 'UPDATE', registroId: String(chofer.idChofer), valoresNuevos: { accion, motivo }, idUsuarioResponsable: req.usuario.idUsuario, usuarioResponsable: `Usuario #${req.usuario.idUsuario}` }, { transaction });
    });
    req.io?.desconectarUsuario?.(idUsuario);
    for (const evento of eventos) req.io?.emit(`viaje_actualizado_${evento.idViaje}`, evento);
    return res.json({ mensaje: accion === 'aprobar' ? 'Chofer habilitado por administracion.' : 'Chofer bloqueado. Sus viajes activos fueron cancelados.' });
  } catch (error) { return res.status(error.status || 400).json({ mensaje: error.message }); }
};

exports.pasajero = accion => async (req, res) => {
  const motivo = String(req.body.motivo || '').trim();
  if (accion === 'bloquear' && motivo.length < 5) return res.status(400).json({ mensaje: 'Indica un motivo de al menos 5 caracteres.' });
  let idUsuario;
  try {
    await sequelize.transaction(async transaction => {
      const pasajero = await Pasajero.findByPk(req.params.idPasajero, { transaction, lock: true });
      if (!pasajero) throw Object.assign(new Error('Pasajero no encontrado'), { status: 404 });
      idUsuario = pasajero.idUsuario;
      const usuario = await Usuario.findByPk(idUsuario, { transaction, lock: true });
      usuario.activo = accion === 'activar';
      pasajero.estadoPasajero = accion === 'activar' ? 'ACTIVO' : 'BLOQUEADO';
      await usuario.save({ transaction });
      await pasajero.save({ transaction });
      await require('../models/relaciones').Auditoria.create({ tablaAfectada: 'ModeracionPasajero', accion: 'UPDATE', registroId: String(pasajero.idPasajero), valoresNuevos: { accion, motivo }, idUsuarioResponsable: req.usuario.idUsuario, usuarioResponsable: `Usuario #${req.usuario.idUsuario}` }, { transaction });
    });
    req.io?.desconectarUsuario?.(idUsuario);
    return res.json({ mensaje: accion === 'activar' ? 'Pasajero habilitado.' : 'Pasajero bloqueado. Se revoco el acceso a su cuenta.' });
  } catch (error) { return res.status(error.status || 400).json({ mensaje: error.message }); }
};

exports.auto = async (req, res) => {
  const { estado } = req.body;
  const motivo = String(req.body.motivo || '').trim();
  if (!['DISPONIBLE', 'INACTIVO'].includes(estado)) return res.status(400).json({ mensaje: 'Estado invalido' });
  if (estado === 'INACTIVO' && motivo.length < 5) return res.status(400).json({ mensaje: 'Indica un motivo de al menos 5 caracteres.' });
  const eventos = [];
  try {
    await sequelize.transaction(async transaction => {
      const auto = await Auto.findByPk(req.params.idAuto, { transaction, lock: true });
      if (!auto) throw Object.assign(new Error('Auto no encontrado'), { status: 404 });
      if (estado === 'INACTIVO') {
        const viajes = await Viaje.unscoped().findAll({ where: { idAuto: auto.idAuto, estadoViaje: { [Op.in]: ['ABIERTO', 'COMPLETO', 'EN_CURSO'] } }, transaction, lock: true });
        for (const viaje of viajes) {
          viaje.estadoViaje = 'CANCELADO';
          await viaje.save({ transaction });
          await Reserva.update({ estadoReserva: 'CANCELADA' }, { where: { idViaje: viaje.idViaje, estadoReserva: { [Op.in]: ['PENDIENTE', 'CONFIRMADA'] } }, transaction, individualHooks: true });
          eventos.push({ idViaje: viaje.idViaje, estadoViaje: 'CANCELADO' });
        }
      }
      auto.estado = estado;
      await auto.save({ transaction });
      await require('../models/relaciones').Auditoria.create({ tablaAfectada: 'ModeracionAuto', accion: 'UPDATE', registroId: String(auto.idAuto), valoresNuevos: { estado, motivo }, idUsuarioResponsable: req.usuario.idUsuario, usuarioResponsable: `Usuario #${req.usuario.idUsuario}` }, { transaction });
    });
    for (const evento of eventos) req.io?.emit(`viaje_actualizado_${evento.idViaje}`, evento);
    return res.json({ mensaje: estado === 'INACTIVO' ? 'Vehiculo deshabilitado. Sus viajes activos fueron cancelados.' : 'Vehiculo habilitado.' });
  } catch (error) { return res.status(error.status || 400).json({ mensaje: error.message }); }
};
