const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Auditoria = sequelize.define('Auditoria', {
  idAuditoria: { type: DataTypes.INTEGER,primaryKey: true, autoIncrement: true},
  tablaAfectada: {type: DataTypes.STRING,allowNull: false },
  accion: {type: DataTypes.ENUM('CREATE', 'UPDATE', 'DELETE'),allowNull: false},
  registroId: {type: DataTypes.STRING,allowNull: false },
  valoresAnteriores: {type: DataTypes.JSON,allowNull: true },
  valoresNuevos: {type: DataTypes.JSON,allowNull: true },
  usuarioResponsable: {type: DataTypes.STRING,allowNull: true 
  }
}, {
  tableName: 'auditorias',
  timestamps: true 
});

module.exports = Auditoria;