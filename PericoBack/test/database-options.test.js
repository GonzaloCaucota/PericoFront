const { test } = require('node:test');
const assert = require('node:assert/strict');
const options = require('../config/database-options');

test('produccion exige URL y TLS', () => {
  assert.throws(() => options({ NODE_ENV: 'production' }), /DATABASE_URL/);
  assert.throws(() => options({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://host/db', DB_SSL: 'false' }), /TLS/);
});
test('TLS verifica certificados incluso si la URL incluye sslmode', () => {
  const config = options({ DATABASE_URL: 'postgresql://u:p@host/db?sslmode=require', DB_SSL_CA: 'LINE1\\nLINE2' });
  assert.equal(config.options.dialectOptions.ssl.rejectUnauthorized, true);
  assert.equal(config.options.dialectOptions.ssl.ca, 'LINE1\nLINE2');
  assert(!config.url.includes('sslmode'));
  assert.equal(config.options.pool.max, 5);
});
test('no usa TLS obligatorio en desarrollo local y valida el pool', () => {
  assert.equal(options({}).options.dialectOptions.ssl, undefined);
  assert.throws(() => options({ DB_POOL_MAX: '-1' }), /DB_POOL_MAX/);
});
