const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

async function migrate(sequelize, { through } = {}) {
  const directory = path.join(__dirname, 'migrations');
  let files = (await fs.readdir(directory)).filter(file => /^\d+_.+\.sql$/.test(file)).sort();
  if (through) {
    if (!files.includes(through)) throw new Error('Version de migracion desconocida');
    files = files.slice(0, files.indexOf(through) + 1);
  }
  return sequelize.transaction(async transaction => {
    // Serializar despliegues concurrentes con un bloqueo transaccional.
    await sequelize.query('SELECT pg_advisory_xact_lock(82419031)', { transaction });
    await sequelize.query(`CREATE SCHEMA IF NOT EXISTS taxi;
      CREATE TABLE IF NOT EXISTS taxi.schema_migrations (
        version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
      )`, { transaction });
    const [existing] = await sequelize.query('SELECT version, checksum FROM taxi.schema_migrations', { transaction });
    const applied = new Map(existing.map(row => [row.version, row.checksum]));
    for (const version of applied.keys()) {
      if (!files.includes(version)) throw new Error(`Falta la migracion aplicada ${version}`);
    }
    const completed = [];
    for (const version of files) {
      const sql = await fs.readFile(path.join(directory, version), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      if (applied.has(version)) {
        if (applied.get(version) !== checksum) throw new Error(`La migracion ${version} fue modificada despues de aplicarse`);
        continue;
      }
      await sequelize.query(sql, { transaction });
      await sequelize.query('INSERT INTO taxi.schema_migrations (version, checksum) VALUES (:version, :checksum)', {
        replacements: { version, checksum }, transaction,
      });
      completed.push(version);
    }
    return completed;
  });
}

module.exports = { migrate };
if (require.main === module) {
  const sequelize = require('../config/database');
  migrate(sequelize)
    .then(files => console.log(files.length ? `Migraciones aplicadas: ${files.join(', ')}` : 'Base de datos actualizada'))
    .catch(error => { console.error('Error de migracion:', error.message); process.exitCode = 1; })
    .finally(() => sequelize.close());
}
