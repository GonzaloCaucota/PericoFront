const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
module.exports = sequelize.define('Recorrido', {
  idRecorrido: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  codigo: { type: DataTypes.STRING(100), allowNull: false },
  idParadaOrigen: { type: DataTypes.INTEGER, allowNull: false },
  idParadaDestino: { type: DataTypes.INTEGER, allowNull: false },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  origen: { type: DataTypes.VIRTUAL, get() { return this.paradaOrigen?.ciudad?.nombre; } },
  destino: { type: DataTypes.VIRTUAL, get() { return this.paradaDestino?.ciudad?.nombre; } },
}, { tableName: 'recorridos', timestamps: true });
