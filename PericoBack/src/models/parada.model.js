const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
module.exports = sequelize.define('Parada', {
  idParada: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  idCiudad: { type: DataTypes.INTEGER, allowNull: false },
  nombre: { type: DataTypes.STRING, allowNull: false },
  referencia: DataTypes.TEXT,
  ubicacionConfirmada: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'paradas', timestamps: true });
