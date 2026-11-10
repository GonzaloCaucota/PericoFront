const sequelize = require('../../config/database');

// Este archivo centraliza asociaciones Sequelize. Si un include falla, revisar primero los alias definidos aca.
// Modelos base y perfiles de usuario.
const Usuario = require('./usuario.model');
const Pasajero = require('./pasajero.model');
const Chofer = require('./chofer.model');
const Admin = require('./admin.model');

// Modelos operativos del sistema.
const Auto = require('./auto.model');
const TurnoChofer = require('./turnoChofer.js');
const Viaje = require('./viaje.model');
const Reserva = require('./reserva.model');
const Auditoria = require('./auditoria.model');

// ---------------------------------------------------------------------------
// Usuario y perfiles
// ---------------------------------------------------------------------------
// Usuario funciona como una "superclase" conceptual.
// Aca se guardan los datos comunes: nombre, apellido, email, password,
// telefono, activo y rol.
//
// Pasajero, Chofer y Admin guardan solo los datos propios de cada perfil.
// Cada perfil se relaciona con un Usuario mediante idUsuario.

Usuario.hasOne(Pasajero, {
  foreignKey: 'idUsuario',
  as: 'perfilPasajero',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Pasajero.belongsTo(Usuario, {
  foreignKey: 'idUsuario',
  as: 'usuario',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Usuario.hasOne(Chofer, {
  foreignKey: 'idUsuario',
  as: 'perfilChofer',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Chofer.belongsTo(Usuario, {
  foreignKey: 'idUsuario',
  as: 'usuario',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Usuario.hasOne(Admin, {
  foreignKey: 'idUsuario',
  as: 'perfilAdmin',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Admin.belongsTo(Usuario, {
  foreignKey: 'idUsuario',
  as: 'usuario',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

// ---------------------------------------------------------------------------
// Choferes, autos y turnos
// ---------------------------------------------------------------------------
// Chofer y Auto tienen una relacion muchos a muchos.
// TurnoChofer es la tabla intermedia que registra que chofer usa que auto
// y en que horario.

Chofer.belongsToMany(Auto, {
  through: { model: TurnoChofer, unique: false },
  foreignKey: 'idChofer',
  otherKey: 'idAuto',
  as: 'autos',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Auto.belongsToMany(Chofer, {
  through: { model: TurnoChofer, unique: false },
  foreignKey: 'idAuto',
  otherKey: 'idChofer',
  as: 'choferes',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

// ---------------------------------------------------------------------------
// Viajes
// ---------------------------------------------------------------------------
// Un viaje es realizado por un chofer y utiliza un auto.
// Se usa RESTRICT para evitar borrar choferes/autos que ya tienen viajes.

Chofer.hasMany(Viaje, {
  foreignKey: { name: 'idChofer', allowNull: false },
  as: 'viajes',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

Viaje.belongsTo(Chofer, {
  foreignKey: { name: 'idChofer', allowNull: false },
  as: 'chofer',
});

Auto.hasMany(Viaje, {
  foreignKey: { name: 'idAuto', allowNull: false },
  as: 'viajes',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

Viaje.belongsTo(Auto, {
  foreignKey: { name: 'idAuto', allowNull: false },
  as: 'auto',
});

// ---------------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------------
// Un pasajero puede tener muchas reservas.
// Un viaje puede tener muchas reservas.
// Cada reserva pertenece a un pasajero y a un viaje.

Pasajero.hasMany(Reserva, {
  foreignKey: 'idPasajero',
  as: 'reservas',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Reserva.belongsTo(Pasajero, {
  foreignKey: 'idPasajero',
  as: 'pasajero',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Viaje.hasMany(Reserva, {
  foreignKey: 'idViaje',
  as: 'reservas',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Reserva.belongsTo(Viaje, {
  foreignKey: 'idViaje',
  as: 'viaje',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

// ---------------------------------------------------------------------------
// Hooks Globales de Auditoría
// ---------------------------------------------------------------------------
const registrarLog = async (accion, instance, options) => {
  try {
    const sinSecretos = (datos) => {
      if (!datos) return null;
      const { passwordHash, ...resto } = datos;
      return resto;
    };
    const tablaAfectada = instance.constructor.name; 

    if (tablaAfectada === 'Auditoria') return; // Evitamos el bucle infinito ignorando la propia tabla de auditoría

    // Captura Del ID dinámicamente dependiendo del modelo que se afectó
    const registroId = instance.id || instance.idReserva || instance.idUsuario || instance.idPasajero || instance.idChofer || instance.idAuto || 'N/A';

    await Auditoria.create({
      tablaAfectada,
      accion,
      registroId: registroId.toString(),
      valoresAnteriores: accion !== 'CREATE' ? sinSecretos(instance._previousDataValues) : null,
      valoresNuevos: accion !== 'DELETE' ? sinSecretos(instance.dataValues) : null,
      usuarioResponsable: options.usuarioResponsable || 'Sistema/Anonimo' 
    }, { transaction: options.transaction });
  } catch (error) {
    console.error('Error en Hook de Auditoría:', error.message);
  }
};

sequelize.afterCreate((instance, options) => registrarLog('CREATE', instance, options));
sequelize.afterUpdate((instance, options) => registrarLog('UPDATE', instance, options));
sequelize.afterDestroy((instance, options) => registrarLog('DELETE', instance, options));

module.exports = {
  sequelize,
  Usuario,
  Pasajero,
  Chofer,
  Admin,
  Auto,
  TurnoChofer,
  Viaje,
  Reserva,
  Auditoria,
};
