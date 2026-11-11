module.exports = async function cuentaHabilitada(payload) {
  const { Usuario, Chofer, Pasajero, Admin, HabilitacionChofer } = require('../models/relaciones');
  const cuenta = await Usuario.findByPk(payload.idUsuario);
  if (!cuenta?.activo || cuenta.rol !== payload.rol) return false;
  const modelos = { CHOFER: Chofer, PASAJERO: Pasajero, ADMIN: Admin };
  const perfil = await modelos[payload.rol]?.findOne({ where: { idUsuario: payload.idUsuario } });
  if (!perfil) return false;
  if (payload.rol === 'ADMIN') return perfil.estadoAdmin === 'ACTIVO';
  if (payload.rol === 'PASAJERO') return perfil.estadoPasajero === 'ACTIVO';
  const habilitacion = await HabilitacionChofer.findByPk(perfil.idChofer);
  return habilitacion?.estado === 'APROBADO' && ['DISPONIBLE', 'EN_VIAJE', 'DESCANSO'].includes(perfil.estadoChofer);
};

module.exports.choferAprobado = async idChofer => {
  const { Chofer } = require('../models/relaciones');
  const chofer = await Chofer.findByPk(idChofer);
  return Boolean(chofer && await module.exports({ idUsuario: chofer.idUsuario, rol: 'CHOFER' }));
};
