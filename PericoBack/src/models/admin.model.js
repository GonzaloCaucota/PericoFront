const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

// Modelo del perfil de administrador.
// Se vincula con Usuario mediante idUsuario para reutilizar los datos comunes.
const Admin = sequelize.define(
  'Admin',
  {
    idAdmin: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    idUsuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      // FK hacia usuarios. Cada admin pertenece a un usuario.
      references: {
        model: { tableName: 'usuarios', schema: 'taxi' },
        key: 'idUsuario',
      },
    },
    estadoAdmin: {
      type: DataTypes.ENUM('ACTIVO', 'SUSPENDIDO', 'INACTIVO', 'ELIMINADO'),
      allowNull: false,
      defaultValue: 'ACTIVO',
    },
  },
  {
    tableName: 'admins',
    timestamps: true,
  }
);

module.exports = Admin;
