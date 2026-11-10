const { DataTypes } = require('sequelize');
const sequelize = require('./../../config/database'); 

const Auto = sequelize.define('Auto', {
     idAuto: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    patente: {type: DataTypes.STRING, allowNull: false, unique: true },
    marca: {type: DataTypes.STRING, allowNull: false},
    modelo: {type: DataTypes.STRING, allowNull: false},
    capacidadAsientos: {type: DataTypes.INTEGER, allowNull: false, validate: { isInt: true, min: 1 }},
    estado: {
        type: DataTypes.ENUM('DISPONIBLE', 'EN_VIAJE', 'EN_TALLER', 'INACTIVO'), 
        allowNull: false,
        defaultValue: 'DISPONIBLE' //estado por defecto 
    },
}, {
    tableName: 'autos', // Nombre de la tabla en minúsculas y plural
    timestamps: true, // Crea automáticamente los campos createdAt y updatedAt
});

/*Auto.associate = (models) => {
    // Esto le avisa al sistema que Auto se conecta con Chofer mediante TurnoChofer
    Auto.belongsToMany(models.Chofer, { 
        through: models.TurnoChofer, 
        foreignKey: 'idAuto',
        otherKey: 'idChofer',
        as: 'choferes'
    })};*/

module.exports = Auto;