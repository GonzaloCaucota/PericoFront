const fs = require('node:fs');

function positiveInteger(value, fallback, name) {
  const number = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`${name} debe ser un entero positivo`);
  return number;
}

module.exports = function databaseOptions(env = process.env) {
  const production = env.NODE_ENV === 'production';
  if (production && !env.DATABASE_URL) throw new Error('DATABASE_URL es obligatoria en produccion');
  const ssl = env.DB_SSL === undefined ? Boolean(env.DATABASE_URL) : env.DB_SSL === 'true';
  if (production && !ssl) throw new Error('La conexion de produccion requiere TLS (DB_SSL=true)');
  let url = env.DATABASE_URL;
  if (url) {
    const parsed = new URL(url);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('DATABASE_URL debe ser PostgreSQL');
    // pg no debe reemplazar la verificacion TLS configurada abajo con parametros de la URL.
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) parsed.searchParams.delete(key);
    url = parsed.toString();
  }
  const ca = env.DB_SSL_CA?.replace(/\\n/g, '\n') || (env.DB_SSL_CA_FILE ? fs.readFileSync(env.DB_SSL_CA_FILE, 'utf8') : undefined);
  return {
    url,
    options: {
      dialect: 'postgres',
      logging: false,
      define: { schema: 'taxi' },
      pool: {
        max: positiveInteger(env.DB_POOL_MAX, 5, 'DB_POOL_MAX'),
        min: 0,
        acquire: positiveInteger(env.DB_POOL_ACQUIRE_MS, 30000, 'DB_POOL_ACQUIRE_MS'),
        idle: 10000,
      },
      dialectOptions: {
        application_name: 'taxi-compartido',
        connectionTimeoutMillis: 10000,
        statement_timeout: 15000,
        ...(ssl ? { ssl: { require: true, rejectUnauthorized: true, ...(ca ? { ca } : {}) } } : {}),
      },
    },
  };
};
