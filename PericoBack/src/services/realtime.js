const jwt = require('jsonwebtoken');
const { Usuario, Chofer, Pasajero, Reserva, Viaje } = require('../models/relaciones');

module.exports = function configurarTiempoReal(io) {
  io.use(async (socket, next) => {
    try {
      const usuario = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      const cuenta = await Usuario.findByPk(usuario.idUsuario);
      if (!cuenta?.activo || cuenta.rol !== usuario.rol) throw new Error('Cuenta no habilitada');
      socket.data.usuario = usuario;
      next();
    } catch { next(new Error('No autorizado')); }
  });
  io.on('connection', socket => {
    const usuario = socket.data.usuario;
    socket.join(`usuario:${usuario.idUsuario}`);
    if (usuario.rol === 'ADMIN') socket.join('admins');
    const timer = setTimeout(() => socket.disconnect(true), Math.max(0, usuario.exp * 1000 - Date.now()));
    timer.unref();
    socket.on('disconnect', () => clearTimeout(timer));
  });
  return {
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
        canal.emit(evento, datos);
      })().catch(error => console.error('Error al emitir evento:', error.message));
    }
  };
};
