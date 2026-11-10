const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

// Modelo Reserva
const Reserva = sequelize.define(
  'Reserva',
  {
    idReserva: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    idPasajero: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: { tableName: 'pasajeros', schema: 'taxi' },
        key: 'idPasajero',
      },
    },

    idViaje: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: { tableName: 'viajes', schema: 'taxi' },
        key: 'idViaje',
      },
    },

    cantidadAsientos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { isInt: true, min: 1 },
    },

    importeTotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0.01 },
    },

    estadoReserva: {
      type: DataTypes.ENUM(
        'PENDIENTE',
        'CONFIRMADA',
        'CANCELADA',
        'UTILIZADA',
        'NO_PRESENTADO'
      ),
      allowNull: false,
      defaultValue: 'PENDIENTE',
    },

    estadoPago: {
      type: DataTypes.ENUM(
        'PENDIENTE',
        'PAGADO',
        'REEMBOLSADO'
      ),
      allowNull: false,
      defaultValue: 'PENDIENTE',
    },
  },
  {
    tableName: 'reservas',
    timestamps: true,
  }
);

module.exports = Reserva;