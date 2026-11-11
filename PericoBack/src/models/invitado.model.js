const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const Invitado = sequelize.define('Invitado', {
  idInvitado: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
  telefono: { type: DataTypes.STRING(20), allowNull: false },
  latitud: { type: DataTypes.DECIMAL(10, 8), allowNull: true },
  longitud: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
  precision: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  ubicacionActualizadaAt: { type: DataTypes.DATE, allowNull: true },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
}, { tableName: 'invitados', timestamps: true, defaultScope: { attributes: { exclude: ['tokenHash'] } } });
Invitado.prototype.toJSON = function () { const data = this.get({ plain: true }); delete data.tokenHash; return data; };
module.exports = Invitado;
