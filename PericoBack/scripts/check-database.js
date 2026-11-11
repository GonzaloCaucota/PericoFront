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
const { sequelize, Usuario, Pasajero, Chofer, Auto, TurnoChofer, Viaje, Reserva, Auditoria, Recorrido, Admin, HabilitacionChofer } = models;
const { migrate } = require('../db/migrate');
const { app, server, start, shutdown } = require('../index');

async function main() {
  const [[state]] = await sequelize.query("SELECT to_regclass('taxi.schema_migrations') AS tabla");
  const legacy = [];
  if (!state.tabla) {
    await migrate(sequelize, { through: '002_constraints_indexes.sql' });
    await sequelize.transaction(async transaction => {
      const query = (sql, replacements = {}) => sequelize.query(sql, { transaction, replacements });
      const [[user]] = await query(`INSERT INTO taxi.usuarios (nombre, apellido, email, "passwordHash", telefono, rol, "createdAt", "updatedAt") VALUES ('Test', 'Migracion', :email, 'no-login', '000', 'CHOFER', now(), now()) RETURNING "idUsuario"`, { email: `migration-${randomUUID()}@example.test` });
      const [[driver]] = await query(`INSERT INTO taxi.choferes ("idUsuario", "licenciaConducir", "fechaHabilitacion", "createdAt", "updatedAt") VALUES (:id, :licencia, '2026-01-01', now(), now()) RETURNING "idChofer"`, { id: user.idUsuario, licencia: randomUUID() });
      const [[car]] = await query(`INSERT INTO taxi.autos (patente, marca, modelo, "capacidadAsientos", "createdAt", "updatedAt") VALUES (:patente, 'Test', 'Test', 4, now(), now()) RETURNING "idAuto"`, { patente: randomUUID() });
      for (const [origen, destino] of [[' perico ', 'Jujuy'], ['Ciudad heredada', 'Destino heredado']]) {
        const [[trip]] = await query(`INSERT INTO taxi.viajes (origen, destino, "idChofer", "idAuto", "fechaSalida", "horaSalida", "tarifaPorAsiento", "asientosDisponibles", "createdAt", "updatedAt") VALUES (:origen, :destino, :driver, :car, '2026-11-10', '10:00', 1234, 3, now(), now()) RETURNING "idViaje"`, { origen, destino, driver: driver.idChofer, car: car.idAuto });
        legacy.push(trip.idViaje);
      }
    });
  }
  await migrate(sequelize);
  if (legacy.length) {
    const conocido = await Viaje.findByPk(legacy[0]);
    assert.equal(conocido.origen, 'Perico');
    assert.equal(conocido.destino, 'San Salvador de Jujuy');
    assert.equal(Number(conocido.tarifaPorAsiento), 1234);
    assert.equal(conocido.asientosDisponibles, 3);
    const historico = await Viaje.findByPk(legacy[1]);
    assert.equal(historico.origen, 'Ciudad heredada');
    assert.equal(historico.destino, 'Destino heredado');
    assert.equal(historico.recorrido.activo, false);
    console.log('Migracion de viajes anteriores verificada: pares conocidos y recorridos historicos conservados');
  }
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
  const adminUser = await Usuario.create({ nombre: 'Admin', apellido: 'Test', email: `admin-${suffix}@example.test`, telefono: '123', passwordHash: 'test-password', rol: 'ADMIN' });
  const adminPerfil = await Admin.create({ idUsuario: adminUser.idUsuario });
  const chofer = await Chofer.create({ idUsuario: choferUser.idUsuario, licenciaConducir: suffix, fechaHabilitacion: '2026-01-01' });
  const auto = await Auto.create({ patente: suffix, marca: 'Test', modelo: 'Test', capacidadAsientos: 1 });
  for (const fecha of ['2026-11-10', '2026-11-11']) {
    await TurnoChofer.create({ idChofer: chofer.idChofer, idAuto: auto.idAuto, fecha, horaInicio: '08:00', horaFin: '16:00' });
  }
  assert.equal(new Set((await chofer.getAutos()).map(item => item.idAuto)).size, 1, 'La relacion muchos-a-muchos debe funcionar');
  const recorrido = await Recorrido.findOne({ where: { codigo: 'PERICO_SSJ' } });
  assert(recorrido);
  assert.equal((await Recorrido.findAll({ where: { activo: true } })).length, 4);
  const viaje = await Viaje.create({ idChofer: chofer.idChofer, idAuto: auto.idAuto, idRecorrido: recorrido.idRecorrido, fechaSalida: '2026-11-10', horaSalida: '10:00', tarifaPorAsiento: 1000, asientosDisponibles: 1 });
  await assert.rejects(sequelize.query('UPDATE taxi.viajes SET "asientosDisponibles" = -1 WHERE "idViaje" = :id', { replacements: { id: viaje.idViaje } }), error => error.original?.code === '23514');
  await assert.rejects(sequelize.query('UPDATE taxi.pasajeros SET "idUsuario" = -1 WHERE "idPasajero" = :id', { replacements: { id: pasajero.idPasajero } }), error => error.original?.code === '23503');
  const logs = await Auditoria.findAll({ where: { tablaAfectada: 'Usuario', registroId: String(pasajeroUser.idUsuario) } });
  assert(logs.length > 0 && logs.every(log => !log.valoresNuevos?.passwordHash), 'Auditoria sin hashes');

  app.set('port', 0);
  await start();
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/health`)).status, 200);
  const catalogo = await (await fetch(`${base}/api/recorridos`)).json();
  assert.equal(catalogo.length, 4);
  assert.equal(catalogo.find(r => r.codigo === 'SSJ_EL_CARMEN').paradaOrigen.nombre, 'Independencia y Lavalle');
  assert.equal(catalogo.find(r => r.codigo === 'SSJ_PERICO').paradaOrigen.nombre, 'Dorrego y Jorge Newbery');
  assert.equal(catalogo.find(r => r.codigo === 'SSJ_PERICO').paradaDestino.ubicacionConfirmada, false);

  const adminLogin = await (await fetch(`${base}/api/usuarios/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: adminUser.email, password: 'test-password' }) })).json();
  assert.equal(adminLogin.rol, 'ADMIN');
  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminLogin.token}` };
  const pendingLogin = await fetch(`${base}/api/usuarios/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: choferUser.email, password: 'test-password' }) });
  assert.equal(pendingLogin.status, 403, 'Sin aprobacion no puede iniciar sesion');
  const approval = await fetch(`${base}/api/admins/choferes/${chofer.idChofer}/aprobar`, { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ motivo: 'Documentacion revisada en prueba' }) });
  assert.equal(approval.status, 200);
  const decision = await HabilitacionChofer.findByPk(chofer.idChofer);
  assert.equal(decision.estado, 'APROBADO');
  assert.equal(decision.idAdmin, adminPerfil.idAdmin);
  const login = await fetch(`${base}/api/usuarios/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: pasajeroUser.email, password: 'test-password' }) });
  const session = await login.json();
  assert.equal(session.status, 1);
  const driverLogin = await (await fetch(`${base}/api/usuarios/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: choferUser.email, password: 'test-password' }) })).json();
  assert.equal(driverLogin.rol, 'CHOFER');
  for (const option of catalogo) {
    const created = await fetch(`${base}/api/viajes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverLogin.token}` },
      body: JSON.stringify({ idChofer: chofer.idChofer, idAuto: auto.idAuto, idRecorrido: option.idRecorrido, fechaSalida: '2026-11-10', horaSalida: '12:00', tarifaPorAsiento: 1500 }),
    });
    assert.equal(created.status, 201, `No se pudo crear el recorrido ${option.codigo}`);
    const result = await created.json();
    assert.equal(result.viaje.recorrido.codigo, option.codigo);
    assert.equal(result.viaje.origen, option.origen);
  }
  const noCatalogo = await fetch(`${base}/api/viajes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverLogin.token}` },
    body: JSON.stringify({ idChofer: chofer.idChofer, idAuto: auto.idAuto, origen: 'Libre', destino: 'Libre' }),
  });
  assert.equal(noCatalogo.status, 400, 'No se aceptan ciudades libres fuera del catalogo');

  const disponibles = await (await fetch(`${base}/api/viajes/disponibles?idRecorrido=${recorrido.idRecorrido}`, { headers: { Authorization: `Bearer ${session.token}` } })).json();
  assert(disponibles.some(item => item.idViaje === viaje.idViaje && item.origen === 'Perico' && item.destino === 'San Salvador de Jujuy'));

  const reserve = () => fetch(`${base}/api/reservas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ idPasajero: pasajero.idPasajero, idViaje: viaje.idViaje, cantidadAsientos: 1 }),
  });
  const responses = await Promise.all([reserve(), reserve()]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 400], 'No debe haber sobreventa concurrente');
  await viaje.reload();
  assert.equal(viaje.asientosDisponibles, 0);
  assert.equal(await Reserva.count({ where: { idViaje: viaje.idViaje } }), 1);
  const [[estadistica]] = await sequelize.query('SELECT "cantidadReservas" FROM taxi.estadisticas_pasajeros WHERE "idPasajero" = :id', { replacements: { id: pasajero.idPasajero } });
  assert.equal(estadistica.cantidadReservas, 1);
  const [legacyColumns] = await sequelize.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'taxi' AND ((table_name = 'viajes' AND column_name IN ('origen', 'destino')) OR (table_name = 'pasajeros' AND column_name = 'cantidadReservas'))`);
  assert.equal(legacyColumns.length, 0, 'No se almacenan nombres ni contadores redundantes');

  // No se puede obtener el alta enviando estados privilegiados al registro publico.
  const publicEmail = `pending-${suffix}@example.test`;
  const signup = await fetch(`${base}/api/choferes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: 'Pendiente', apellido: 'Test', email: publicEmail, telefono: '123', passwordHash: 'test-password', licenciaConducir: `P-${suffix}`, fechaHabilitacion: '2026-01-01', activo: true, estadoChofer: 'DISPONIBLE' }) });
  assert.equal(signup.status, 201);
  const signupData = await signup.json();
  assert.equal(signupData.usuario.activo, false);
  assert.equal((await HabilitacionChofer.findByPk(signupData.chofer.idChofer)).estado, 'PENDIENTE');
  const unauthApproval = await fetch(`${base}/api/admins/choferes/${signupData.chofer.idChofer}/aprobar`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: '{}' });
  assert.equal(unauthApproval.status, 403);
  const direct = await fetch(`${base}/api/admins/choferes`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ nombre: 'Alta', apellido: 'Directa', email: `direct-${suffix}@example.test`, telefono: '123', passwordHash: 'test-password', licenciaConducir: `D-${suffix}`, fechaHabilitacion: '2026-01-01' }) });
  assert.equal(direct.status, 201);
  const directData = await direct.json();
  assert.equal((await HabilitacionChofer.findByPk(directData.chofer.idChofer)).idAdmin, adminPerfil.idAdmin);
  const guestTrip = await Viaje.create({ idChofer: chofer.idChofer, idAuto: auto.idAuto, idRecorrido: recorrido.idRecorrido, fechaSalida: '2099-11-10', horaSalida: '12:00', tarifaPorAsiento: 1500, asientosDisponibles: 1 });
  const guestResponse = await fetch(`${base}/api/viajes/publicos?idRecorrido=${recorrido.idRecorrido}`);
  assert.equal(guestResponse.status, 200);
  const guestData = await guestResponse.json();
  const guestItem = guestData.find(v => v.idViaje === guestTrip.idViaje);
  assert(guestItem, 'Un invitado ve viajes disponibles sin JWT');
  assert.equal(guestItem.salida, recorrido.paradaOrigen.nombre);
  for (const forbidden of ['chofer', 'reservas', 'usuario', 'idChofer', 'idAuto', 'telefono', 'email', 'passwordHash', 'latitud', 'longitud']) assert.equal(guestItem[forbidden], undefined);
  assert.equal((await fetch(`${base}/api/viajes/publicos?idRecorrido=invalid`)).status, 400);
  assert.equal((await fetch(`${base}/api/reservas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idViaje: guestTrip.idViaje, cantidadAsientos: 1 }) })).status, 401);
  const createGuest = () => fetch(`${base}/api/reservas/invitado`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idViaje: guestTrip.idViaje, nombre: 'Invitado Test', telefono: '+54 388 1234567', cantidadAsientos: 1, importeTotal: 1, estadoPago: 'PAGADO', idPasajero: pasajero.idPasajero }) });
  const guestRace = await Promise.all([createGuest(), createGuest()]);
  assert.deepEqual(guestRace.map(r => r.status).sort(), [201, 409]);
  const guestBooking = await guestRace.find(r => r.status === 201).json();
  assert.equal(Number(guestBooking.reserva.importeTotal), 1500);
  assert.equal(guestBooking.reserva.estadoPago, 'PENDIENTE');
  assert.equal((await Reserva.findByPk(guestBooking.reserva.idReserva)).idPasajero, null);
  const guestHeaders = { 'X-Reserva-Token': guestBooking.token };
  assert.equal((await fetch(`${base}/api/reservas/invitado`)).status, 401);
  assert.equal((await fetch(`${base}/api/reservas/invitado`, { headers: { 'X-Reserva-Token': 'a'.repeat(64) } })).status, 401);
  const lookup = await (await fetch(`${base}/api/reservas/invitado`, { headers: guestHeaders })).json();
  assert.equal(lookup.reserva.idReserva, guestBooking.reserva.idReserva);
  assert.equal(lookup.token, undefined);
  const [[storedGuest]] = await sequelize.query('SELECT "tokenHash" FROM taxi.invitados WHERE "idInvitado" = :id', { replacements: { id: (await Reserva.findByPk(guestBooking.reserva.idReserva)).idInvitado } });
  assert.notEqual(storedGuest.tokenHash, guestBooking.token);
  const guestLocation = body => fetch(`${base}/api/reservas/invitado/ubicacion`, { method: 'PATCH', headers: { ...guestHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await fetch(`${base}/api/reservas/invitado/ubicacion`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  assert.equal((await guestLocation({ latitud: -24.2, longitud: -65.3, precision: 20 })).status, 400, 'Requiere compartir explicitamente');
  assert.equal((await guestLocation({ compartir: true, latitud: 91, longitud: -65, precision: 20 })).status, 400);
  assert.equal((await guestLocation({ compartir: true, latitud: -24.2, longitud: -65.3, precision: -1 })).status, 400);
  assert.equal((await guestLocation({ compartir: true, latitud: -24.2, longitud: -65.3, precision: 20 })).status, 200);
  const guestRecordId = (await Reserva.findByPk(guestBooking.reserva.idReserva)).idInvitado;
  const positioned = await models.Invitado.findByPk(guestRecordId);
  assert.equal(Number(positioned.latitud), -24.2);
  assert(positioned.ubicacionActualizadaAt);
  const privateTrips = await (await fetch(`${base}/api/choferes/${chofer.idChofer}/viajes`, { headers: adminHeaders })).json();
  assert(JSON.stringify(privateTrips).includes('-24.20000000'), 'La ubicacion llega al listado privado del chofer');
  const publicLocated = await (await fetch(`${base}/api/viajes/publicos`)).text();
  assert(!publicLocated.includes('latitud') && !publicLocated.includes('tokenHash'));
  assert.equal((await guestLocation({ compartir: false })).status, 200);
  assert.equal((await models.Invitado.findByPk(guestRecordId)).latitud, null);
  assert.equal((await guestLocation({ compartir: true, latitud: 0, longitud: 0, precision: 0 })).status, 200, 'Cero es una coordenada valida');
  for (let n = 0; n < 2; n++) assert.equal((await fetch(`${base}/api/reservas/invitado/cancelar`, { method: 'PATCH', headers: guestHeaders })).status, 200);
  await guestTrip.reload();
  assert.equal(guestTrip.asientosDisponibles, 1, 'Cancelar dos veces devuelve los asientos una sola vez');
  assert.equal((await models.Invitado.findByPk(guestRecordId)).latitud, null, 'Cancelar retira la ubicacion');
  assert.equal((await guestLocation({ compartir: true, latitud: -24, longitud: -65, precision: 10 })).status, 409, 'No comparte una reserva cancelada');
  const guestAudit = await Auditoria.findOne({ where: { tablaAfectada: 'Invitado' }, order: [['idAuditoria', 'DESC']] });
  assert.equal(guestAudit.valoresNuevos.tokenHash, undefined);
  assert.equal(guestAudit.valoresNuevos.latitud, undefined);
  console.log('Reservas sin cuenta verificadas: concurrencia, precio servidor, comprobantes privados y cancelacion idempotente');
  await guestTrip.update({ estadoViaje: 'CANCELADO' });
  const afterCancel = await (await fetch(`${base}/api/viajes/publicos`)).json();
  assert(!afterCancel.some(v => v.idViaje === guestTrip.idViaje));

  // Google: prueba del flujo propio con verificador simulado, sin credenciales externas.
  const { OAuth2Client } = require('google-auth-library');
  const originalVerifier = OAuth2Client.prototype.verifyIdToken;
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const googleLogin = token => fetch(`${base}/api/usuarios/login-google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  try {
    delete process.env.GOOGLE_CLIENT_ID;
    assert.equal((await googleLogin('test-token')).status, 503);
    process.env.GOOGLE_CLIENT_ID = 'test.apps.googleusercontent.com';
    let verified = true;
    OAuth2Client.prototype.verifyIdToken = async options => {
      assert.equal(options.audience, process.env.GOOGLE_CLIENT_ID);
      if (options.idToken === 'invalid') throw new Error('invalid signature');
      return { getPayload: () => ({ sub: suffix, email_verified: verified, email: `google-${suffix}@example.test`, given_name: 'Google', family_name: 'Test' }) };
    };
    assert.equal((await googleLogin('')).status, 400);
    assert.equal((await googleLogin('invalid')).status, 401);
    verified = false;
    assert.equal((await googleLogin('test-token')).status, 401);
    verified = true;
    const firstGoogle = await googleLogin('test-token');
    assert.equal(firstGoogle.status, 200);
    const firstGoogleData = await firstGoogle.json();
    assert.equal(firstGoogleData.rol, 'PASAJERO');
    assert(firstGoogleData.token && firstGoogleData.idPasajero);
    assert.equal(firstGoogleData.usuario.passwordHash, undefined);
    const secondGoogleData = await (await googleLogin('test-token')).json();
    assert.equal(secondGoogleData.idPasajero, firstGoogleData.idPasajero);
    await Usuario.update({ activo: false }, { where: { idUsuario: firstGoogleData.idUsuario } });
    assert.equal((await googleLogin('test-token')).status, 403);
  } finally {
    OAuth2Client.prototype.verifyIdToken = originalVerifier;
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = originalClientId;
  }
  console.log('Invitados: catalogo publico sin datos privados y reservas protegidas. Google: flujo interno verificado con verificador simulado');
  const banDriver = await fetch(`${base}/api/admins/choferes/${chofer.idChofer}/bloquear`, { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ motivo: 'Incumplimiento verificado' }) });
  assert.equal(banDriver.status, 200);
  assert.equal((await fetch(`${base}/api/choferes/${chofer.idChofer}`, { headers: { Authorization: `Bearer ${driverLogin.token}` } })).status, 401, 'Se rechaza un token emitido antes del bloqueo');
  await viaje.reload();
  assert.equal(viaje.estadoViaje, 'CANCELADO');
  const viajeAuto = await Viaje.create({ idChofer: directData.chofer.idChofer, idAuto: auto.idAuto, idRecorrido: recorrido.idRecorrido, fechaSalida: '2026-11-10', horaSalida: '13:00', tarifaPorAsiento: 1000, asientosDisponibles: 1 });
  const disableCar = await fetch(`${base}/api/admins/autos/${auto.idAuto}/habilitacion`, { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ estado: 'INACTIVO', motivo: 'Revision administrativa' }) });
  assert.equal(disableCar.status, 200);
  await viajeAuto.reload();
  assert.equal(viajeAuto.estadoViaje, 'CANCELADO');
  await fetch(`${base}/api/admins/choferes/${chofer.idChofer}/aprobar`, { method: 'PATCH', headers: adminHeaders, body: '{}' });
  const freshDriver = await (await fetch(`${base}/api/usuarios/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: choferUser.email, password: 'test-password' }) })).json();
  assert.equal(freshDriver.status, 1);
  const forbiddenCar = await fetch(`${base}/api/autos/${auto.idAuto}/estado`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshDriver.token}` }, body: JSON.stringify({ estado: 'DISPONIBLE' }) });
  assert.equal(forbiddenCar.status, 403, 'El chofer no puede reactivar su vehiculo bloqueado');

  const banPassenger = await fetch(`${base}/api/admins/pasajeros/${pasajero.idPasajero}/bloquear`, { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ motivo: 'Incumplimiento verificado' }) });
  assert.equal(banPassenger.status, 200);
  assert.equal((await fetch(`${base}/api/pasajeros/${pasajero.idPasajero}`, { headers: { Authorization: `Bearer ${session.token}` } })).status, 401);
  const reenable = await fetch(`${base}/api/admins/pasajeros/${pasajero.idPasajero}/activar`, { method: 'PATCH', headers: adminHeaders, body: '{}' });
  assert.equal(reenable.status, 200);
  const moderationLogs = await Auditoria.findAll({ where: { tablaAfectada: 'ModeracionChofer', idUsuarioResponsable: adminUser.idUsuario } });
  assert(moderationLogs.length >= 2, 'Se registra el administrador que aprueba y bloquea');
  assert(await Auditoria.findOne({ where: { tablaAfectada: 'HabilitacionChofer', idUsuarioResponsable: adminUser.idUsuario, registroId: String(chofer.idChofer) } }), 'Los hooks de auditoria conservan el actor autenticado');
  // Estadisticas: no multiplicar viajes por reservas ni contar cancelados/ausentes.
  const statsUrl = `${base}/api/choferes/${chofer.idChofer}/estadisticas`;
  const getStats = async url => {
    const response = await fetch(url, { headers: adminHeaders });
    assert.equal(response.status, 200);
    return response.json();
  };
  assert.equal((await getStats(statsUrl)).viajesRealizados, 0);
  const statsTrips = [];
  for (const estadoViaje of ['FINALIZADO', 'FINALIZADO', 'CANCELADO', 'ABIERTO']) {
    statsTrips.push(await Viaje.create({ idChofer: chofer.idChofer, idAuto: auto.idAuto, idRecorrido: recorrido.idRecorrido, fechaSalida: '2026-11-10', horaSalida: '18:00', tarifaPorAsiento: 1000, asientosDisponibles: 0, estadoViaje }));
  }
  for (const [index, cantidadAsientos, estadoReserva] of [[0, 3, 'UTILIZADA'], [0, 2, 'UTILIZADA'], [0, 1, 'CANCELADA'], [0, 1, 'NO_PRESENTADO'], [2, 4, 'UTILIZADA'], [3, 4, 'UTILIZADA']]) {
    await Reserva.create({ idViaje: statsTrips[index].idViaje, idPasajero: pasajero.idPasajero, cantidadAsientos, importeTotal: cantidadAsientos * 1000, estadoReserva });
  }
  assert.deepEqual(await getStats(statsUrl), { idChofer: chofer.idChofer, viajesRealizados: 2, pasajerosTransportados: 5 });
  assert.deepEqual(await getStats(`${base}/api/autos/${auto.idAuto}/estadisticas`), { idAuto: auto.idAuto, viajesRealizados: 2, pasajerosTransportados: 5 });
  assert.equal((await fetch(statsUrl, { headers: { Authorization: `Bearer ${session.token}` } })).status, 403);
  assert.equal((await fetch(`${base}/api/autos/${auto.idAuto}/estadisticas`, { headers: { Authorization: `Bearer ${freshDriver.token}` } })).status, 200);
  await Reserva.update({ estadoReserva: 'NO_PRESENTADO' }, { where: { idViaje: statsTrips[0].idViaje, cantidadAsientos: 3 } });
  assert.equal((await getStats(statsUrl)).pasajerosTransportados, 2, 'Una correccion del historial actualiza el total sin incrementar contadores');
  console.log('Estadisticas verificadas: viajes sin duplicados, asientos utilizados, ceros, exclusiones, permisos y correcciones');
  console.log('Aprobaciones, altas administrativas, bloqueos, revocacion de JWT y auditoria verificadas');
  console.log('Integracion PostgreSQL OK: migraciones repetibles, 14 tablas, ORM, FK, CHECK, turnos repetidos, auditoria, login, health y reservas concurrentes');
}
main()
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => shutdown());
