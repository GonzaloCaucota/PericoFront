require('dotenv').config({ quiet: true });
const { sequelize, Usuario, Admin } = require('../src/models/relaciones');

async function createAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NOMBRE, ADMIN_APELLIDO, ADMIN_TELEFONO } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12 || !ADMIN_NOMBRE || !ADMIN_APELLIDO || !ADMIN_TELEFONO) {
    throw new Error('Definir ADMIN_EMAIL, ADMIN_PASSWORD (12 caracteres minimo), ADMIN_NOMBRE, ADMIN_APELLIDO y ADMIN_TELEFONO');
  }
  await sequelize.transaction(async transaction => {
    const usuario = await Usuario.create({
      email: ADMIN_EMAIL.trim().toLowerCase(), passwordHash: ADMIN_PASSWORD,
      nombre: ADMIN_NOMBRE, apellido: ADMIN_APELLIDO, telefono: ADMIN_TELEFONO,
      rol: 'ADMIN', activo: true,
    }, { transaction });
    await Admin.create({ idUsuario: usuario.idUsuario, estadoAdmin: 'ACTIVO' }, { transaction });
  });
  console.log('Administrador creado. Retirar ADMIN_PASSWORD del entorno.');
}

createAdmin()
  .catch(error => { console.error('No se pudo crear el administrador:', error.name); process.exitCode = 1; })
  .finally(() => sequelize.close());
