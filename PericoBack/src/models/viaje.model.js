const { DataTypes } = require('sequelize');
const sequelize = require('./../../config/database'); 

// Importamos todos los modelos con los que se relaciona Viaje
/*const Chofer = require('./chofer.model'); 
const Auto = require('./auto.model');     
const Reserva = require('./reserva.model');*/ 

const Viaje = sequelize.define('Viaje', {
    idViaje: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    origen: {type: DataTypes.STRING, allowNull: false},
    destino: {type: DataTypes.STRING, allowNull: false},
    fechaSalida: {type: DataTypes.DATEONLY, allowNull: false}, // Guarda solo YYYY-MM-DD
    horaSalida: { type: DataTypes.TIME, allowNull: false}, // Guarda HH:MM:SS
    tarifaPorAsiento: {type: DataTypes.DECIMAL(10, 2),allowNull: false, validate: { min: 0.01 }},
    asientosDisponibles: {type: DataTypes.INTEGER, allowNull:false, validate: { isInt: true, min: 0 }},
    estadoViaje: {
        type: DataTypes.ENUM('ABIERTO', 'COMPLETO', 'EN_CURSO', 'FINALIZADO','CANCELADO'), 
        allowNull: false,
        defaultValue: 'ABIERTO' //estado por defecto 
    },
    
}, {
    tableName: 'viajes', // Nombre de la tabla en minúsculas y plural
    timestamps: true, // Crea automáticamente los campos createdAt y updatedAt
});


module.exports = Viaje;