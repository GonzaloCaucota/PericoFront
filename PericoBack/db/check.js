const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

module.exports = async function checkMigrations(sequelize) {
  const directory = path.join(__dirname, 'migrations');
  const files = (await fs.readdir(directory)).filter(file => /^\d+_.+\.sql$/.test(file)).sort();
  const [rows] = await sequelize.query('SELECT version, checksum FROM taxi.schema_migrations');
  const applied = new Map(rows.map(row => [row.version, row.checksum]));
  if (applied.size !== files.length) throw new Error('Hay migraciones pendientes: ejecutar npm run db:migrate');
  for (const file of files) {
    const checksum = createHash('sha256').update(await fs.readFile(path.join(directory, file))).digest('hex');
    if (applied.get(file) !== checksum) throw new Error(`Migracion ausente o modificada: ${file}`);
  }
};
