const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database'); // Asegúrate de que la ruta apunte a tu archivo
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10; // Número de rondas de sal para bcrypt

// Modelo base del sistema.
// Aca van los datos comunes que pueden compartir pasajeros y choferes.
const Usuario = sequelize.define(
    'Usuario',
    {
      idUsuario: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      nombre: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      apellido: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      telefono: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      rol: {
        type: DataTypes.ENUM('PASAJERO', 'CHOFER', 'ADMIN'),
        allowNull: false,
      },
    },
   {
      tableName: 'usuarios',
      timestamps: true,
      hooks: {
        // Hashea la contraseña automáticamente cada vez que se crea un Usuario.
        beforeCreate: async (usuario) => {
          if (usuario.passwordHash) {
            usuario.passwordHash = await bcrypt.hash(usuario.passwordHash, SALT_ROUNDS);
          }
        },
        // Hashea la contraseña automáticamente si se actualiza (ej: "cambiar contraseña").
        beforeUpdate: async (usuario) => {
          if (usuario.changed('passwordHash') && usuario.passwordHash) {
            usuario.passwordHash = await bcrypt.hash(usuario.passwordHash, SALT_ROUNDS);
          }
        },
      },
    }
  );

  // Compara una contraseña en texto plano contra el hash guardado.
  Usuario.prototype.compararPassword = async function (passwordPlano) {
    if (!this.passwordHash) return false;
    return bcrypt.compare(passwordPlano, this.passwordHash);
  };

  Usuario.prototype.toJSON = function () {
    const datos = this.get({ plain: true });
    delete datos.passwordHash;
    return datos;
  };

  module.exports = Usuario;
