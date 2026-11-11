const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
module.exports = sequelize.define('HabilitacionChofer', {
  idChofer: { type: DataTypes.INTEGER, primaryKey: true },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDIENTE' },
  idAdmin: { type: DataTypes.INTEGER, allowNull: true },
  fechaDecision: { type: DataTypes.DATE, allowNull: true },
  motivo: DataTypes.TEXT,
}, { tableName: 'habilitaciones_chofer', timestamps: true });
