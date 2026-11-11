const jwt = require('jsonwebtoken');
const { Usuario, Chofer, Pasajero, Reserva, Viaje } = require('../models/relaciones');

module.exports = function configurarTiempoReal(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        socket.data.usuario = null;
        return next();
      }
      const usuario = jwt.verify(token, process.env.JWT_SECRET);
      if (!(await require('./cuenta-habilitada')(usuario))) throw new Error('Cuenta no habilitada');
      socket.data.usuario = usuario;
      next();
    } catch { next(new Error('No autorizado')); }
  });
  io.on('connection', socket => {
    const usuario = socket.data.usuario;
    if (!usuario) {
      socket.join('publico');
      return;
    }
    socket.join(`usuario:${usuario.idUsuario}`);
    if (usuario.rol === 'ADMIN') socket.join('admins');
    if (usuario.rol === 'PASAJERO') socket.join('pasajeros');
    const timer = setTimeout(() => socket.disconnect(true), Math.max(0, usuario.exp * 1000 - Date.now()));
    timer.unref();
    socket.on('disconnect', () => clearTimeout(timer));
  });
  return {
    desconectarUsuario(id) { io.in(`usuario:${id}`).disconnectSockets(true); },
    emit(evento, datos) {
      // Los datos de pagos, reservas y ubicacion solo llegan a sus participantes.
      return (async () => {
        const idReserva = datos.idReserva || /(?:reserva_|cancelada_|actualizada_)(\d+)$/.exec(evento)?.[1];
        const reserva = idReserva && await Reserva.findByPk(idReserva);
        const idViaje = datos.idViaje || reserva?.idViaje;
        const viaje = idViaje && await Viaje.findByPk(idViaje);
        const destinatarios = new Set();
        const chofer = viaje && await Chofer.findByPk(viaje.idChofer);
        if (chofer) destinatarios.add(chofer.idUsuario);
        if (reserva) {
          const pasajero = await Pasajero.findByPk(reserva.idPasajero);
          if (pasajero) destinatarios.add(pasajero.idUsuario);
        } else if (viaje) {
          const reservas = await Reserva.findAll({ where: { idViaje: viaje.idViaje } });
          for (const item of reservas) {
            const pasajero = await Pasajero.findByPk(item.idPasajero);
            if (pasajero) destinatarios.add(pasajero.idUsuario);
          }
        }
        let canal = io.to('admins');
        for (const id of destinatarios) canal = canal.to(`usuario:${id}`);
        if (/^(?:asientos_actualizados_viaje_|viaje_actualizado_|viaje_creado)/.test(evento)) {
          canal = canal.to('pasajeros').to('publico');
        }
        canal.emit(evento, datos);
      })().catch(error => console.error('Error al emitir evento:', error.message));
    }
  };
};
