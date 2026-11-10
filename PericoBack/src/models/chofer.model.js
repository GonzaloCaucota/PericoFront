const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database'); // Asegúrate de que la ruta apunte a tu archivo



// Modelo del perfil de chofer.
// Se vincula con Usuario mediante idUsuario para reutilizar los datos comunes.
const Chofer = sequelize.define(
  'Chofer',
  {
      idChofer: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      idUsuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        // FK hacia usuarios. Cada chofer pertenece a un usuario.
        references: {
          model: { tableName: 'usuarios', schema: 'taxi' },
          key: 'idUsuario',
        },
      },
      licenciaConducir: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      estadoChofer: {
        type: DataTypes.ENUM(
          'DISPONIBLE',
          'EN_VIAJE',
          'DESCANSO',
          'SUSPENDIDO',
          'INACTIVO',
          'ELIMINADO'
        ),
        allowNull: false,
        defaultValue: 'DISPONIBLE',
      },
      fechaHabilitacion: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      calificacion: {
        type: DataTypes.DECIMAL(3, 2),
        defaultValue: 0,
      },
      latitud: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      longitud: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      precision: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
    },
    {
      tableName: 'choferes',
      timestamps: true,
    }
  );

module.exports = Chofer;
