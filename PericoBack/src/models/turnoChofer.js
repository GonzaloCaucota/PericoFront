const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database'); 

const TurnoChofer = sequelize.define('TurnoChofer', {
    idTurnoChofer: {
  type: DataTypes.INTEGER,
  primaryKey: true,
  autoIncrement: true
},
    idChofer: {type: DataTypes.INTEGER,allowNull: false },
    idAuto: {type: DataTypes.INTEGER,allowNull: false},
    fecha: {type: DataTypes.DATEONLY, allowNull: false}, // Guarda solo YYYY-MM-DD
    horaInicio: { type: DataTypes.TIME, allowNull: false}, // Guarda HH:MM:SS
    horaFin: {type: DataTypes.TIME,allowNull: false}
}, {
    tableName: 'turnos_chofer',
    timestamps: true
});


module.exports = TurnoChofer;