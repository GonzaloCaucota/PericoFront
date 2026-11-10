// Solo se ejecuta explicitamente contra una base local aislada.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const url = new URL(process.env.DB_INTEGRATION_URL || 'postgresql://localhost/taxi_integration');
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/taxi_integration') {
  throw new Error('DB_INTEGRATION_URL debe apuntar a localhost/taxi_integration');
}
process.env.DATABASE_URL = url.toString();
process.env.DB_SSL = 'false';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomUUID();
const models = require('../src/models/relaciones');
const { sequelize, Usuario, Pasajero, Chofer, Auto, TurnoChofer, Viaje, Reserva, Auditoria } = models;
const { migrate } = require('../db/migrate');
const { app, server, start, shutdown } = require('../index');

async function main() {
  await migrate(sequelize);
  assert.deepEqual(await migrate(sequelize), [], 'Las migraciones deben ser repetibles');
  await require('../db/check')(sequelize);
  const [tables] = await sequelize.query("SELECT tablename FROM pg_tables WHERE schemaname = 'taxi'");
  for (const model of sequelize.modelManager.models) {
    assert(tables.some(table => table.tablename === model.tableName), `Falta ${model.tableName}`);
    await model.findAll({ limit: 1 }); // Incluye tipos ENUM, timestamps y nombres de columnas reales.
  }
  const suffix = randomUUID();
  const pasajeroUser = await Usuario.create({ nombre: 'Test', apellido: 'Pasajero', email: `${suffix}@example.test`, telefono: '123', passwordHash: 'test-password', rol: 'PASAJERO' });
  const pasajero = await Pasajero.create({ idUsuario: pasajeroUser.idUsuario });
  const choferUser = await Usuario.create({ nombre: 'Test', apellido: 'Chofer', email: `c-${suffix}@example.test`, telefono: '123', passwordHash: 'test-password', rol: 'CHOFER' });
  const chofer = await Chofer.create({ idUsuario: choferUser.idUsuario, licenciaConducir: suffix, fechaHabilitacion: '2026-01-01' });
  const auto = await Auto.create({ patente: suffix, marca: 'Test', modelo: 'Test', capacidadAsientos: 1 });
  for (const fecha of ['2026-11-10', '2026-11-11']) {
    await TurnoChofer.create({ idChofer: chofer.idChofer, idAuto: auto.idAuto, fecha, horaInicio: '08:00', horaFin: '16:00' });
  }
  assert.equal(new Set((await chofer.getAutos()).map(item => item.idAuto)).size, 1, 'La relacion muchos-a-muchos debe funcionar');
  const viaje = await Viaje.create({ idChofer: chofer.idChofer, idAuto: auto.idAuto, origen: 'Perico', destino: 'Jujuy', fechaSalida: '2026-11-10', horaSalida: '10:00', tarifaPorAsiento: 1000, asientosDisponibles: 1 });
  await assert.rejects(sequelize.query('UPDATE taxi.viajes SET "asientosDisponibles" = -1 WHERE "idViaje" = :id', { replacements: { id: viaje.idViaje } }), error => error.original?.code === '23514');
  await assert.rejects(sequelize.query('UPDATE taxi.pasajeros SET "idUsuario" = -1 WHERE "idPasajero" = :id', { replacements: { id: pasajero.idPasajero } }), error => error.original?.code === '23503');
  const logs = await Auditoria.findAll({ where: { tablaAfectada: 'Usuario', registroId: String(pasajeroUser.idUsuario) } });
  assert(logs.length > 0 && logs.every(log => !log.valoresNuevos?.passwordHash), 'Auditoria sin hashes');

  app.set('port', 0);
  await start();
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/health`)).status, 200);
  const login = await fetch(`${base}/api/usuarios/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: pasajeroUser.email, password: 'test-password' }) });
  const session = await login.json();
  assert.equal(session.status, 1);
  const reserve = () => fetch(`${base}/api/reservas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ idPasajero: pasajero.idPasajero, idViaje: viaje.idViaje, cantidadAsientos: 1 }),
  });
  const responses = await Promise.all([reserve(), reserve()]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 400], 'No debe haber sobreventa concurrente');
  await viaje.reload();
  assert.equal(viaje.asientosDisponibles, 0);
  assert.equal(await Reserva.count({ where: { idViaje: viaje.idViaje } }), 1);
  console.log('Integracion PostgreSQL OK: migraciones repetibles, 9 tablas, ORM, FK, CHECK, turnos repetidos, auditoria, login, health y reservas concurrentes');
}
main()
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => shutdown());
