const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const auth = require('../src/controllers/auth.controller');
const models = require('../src/models/relaciones');
const reservas = require('../src/controllers/reserva.controller');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('rechaza esquemas distintos de Bearer', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const token = jwt.sign({ idUsuario: 1, rol: 'PASAJERO' }, process.env.JWT_SECRET);
  const res = response();
  await auth.verifyToken({ headers: { authorization: `Basic ${token}` } }, res, () => assert.fail('Acceso indebido'));
  assert.equal(res.code, 401);
});
test('no permite modificar el perfil de otro usuario', async () => {
  const res = response();
  await auth.propietarioPerfil({ findByPk: async () => ({ idUsuario: 2 }) }, 'id')({ usuario: { idUsuario: 1, rol: 'PASAJERO' }, params: { id: 2 } }, res, () => assert.fail('Acceso indebido'));
  assert.equal(res.code, 403);
});
test('nunca serializa el hash de contraseña', () => {
  const usuario = models.Usuario.build({ nombre: 'Ana', passwordHash: 'privado' });
  assert.equal(JSON.parse(JSON.stringify(usuario)).passwordHash, undefined);
});
test('rechaza asientos negativos antes de consultar el viaje', async (t) => {
  let rollback = false;
  t.mock.method(models.sequelize, 'transaction', async () => ({ rollback: async () => { rollback = true; } }));
  const res = response();
  await reservas.registrarReserva({ body: { cantidadAsientos: -2 }, usuario: { rol: 'PASAJERO', idUsuario: 1 } }, res);
  assert.equal(res.code, 400);
  assert.equal(rollback, true);
});
test('calcula el precio y estado en servidor aunque el cliente los manipule', async (t) => {
  t.mock.method(require('../src/services/cuenta-habilitada'), 'choferAprobado', async () => true);
  t.mock.method(models.sequelize, 'transaction', async () => ({ commit: async () => {}, rollback: async () => {} }));
  t.mock.method(models.Pasajero, 'findByPk', async () => ({ idPasajero: 3, idUsuario: 1, estadoPasajero: 'ACTIVO' }));
  t.mock.method(models.Viaje, 'findByPk', async () => ({ idViaje: 2, estadoViaje: 'ABIERTO', asientosDisponibles: 4, tarifaPorAsiento: '1500.00', save: async () => {} }));
  let creado;
  t.mock.method(models.Reserva, 'create', async datos => { creado = { idReserva: 4, ...datos }; return creado; });
  const res = response();
  await reservas.registrarReserva({ usuario: { rol: 'PASAJERO', idUsuario: 1 }, body: { idPasajero: 3, idViaje: 2, cantidadAsientos: 2, importeTotal: 1, estadoPago: 'PAGADO' } }, res);
  assert.equal(res.code, 201);
  assert.equal(creado.importeTotal, '3000.00');
  assert.equal(creado.estadoPago, 'PENDIENTE');
});
test('un chofer no puede cobrar reservas de otro viaje', async (t) => {
  t.mock.method(models.Reserva, 'findByPk', async () => ({ idViaje: 2 }));
  t.mock.method(models.Viaje, 'findByPk', async () => ({ idChofer: 3 }));
  t.mock.method(models.Chofer, 'findByPk', async () => ({ idUsuario: 99 }));
  const res = response();
  await auth.choferReserva({ usuario: { idUsuario: 1, rol: 'CHOFER' }, params: { idReserva: 1 } }, res, () => assert.fail('Cobro ajeno'));
  assert.equal(res.code, 403);
});
test('un pasajero no puede reservar usando la identidad de otro', async (t) => {
  t.mock.method(models.sequelize, 'transaction', async () => ({ rollback: async () => {} }));
  t.mock.method(models.Pasajero, 'findByPk', async () => ({ idPasajero: 3, idUsuario: 99, estadoPasajero: 'ACTIVO' }));
  const res = response();
  await reservas.registrarReserva({ usuario: { rol: 'PASAJERO', idUsuario: 1 }, body: { idPasajero: 3, cantidadAsientos: 1 } }, res);
  assert.equal(res.code, 403);
});
test('un token firmado no habilita una cuenta desactivada', async (t) => {
  t.mock.method(models.Usuario, 'findByPk', async () => ({ activo: false, rol: 'PASAJERO' }));
  const token = jwt.sign({ idUsuario: 1, rol: 'PASAJERO' }, process.env.JWT_SECRET);
  const res = response();
  await auth.verifyToken({ headers: { authorization: `Bearer ${token}` } }, res, () => assert.fail('Cuenta desactivada'));
  assert.equal(res.code, 401);
});
test('eventos de pago se limitan al pasajero, chofer y administradores', async (t) => {
  t.mock.method(models.Reserva, 'findByPk', async () => ({ idPasajero: 1, idViaje: 2 }));
  t.mock.method(models.Viaje, 'findByPk', async () => ({ idChofer: 3 }));
  t.mock.method(models.Chofer, 'findByPk', async () => ({ idUsuario: 10 }));
  t.mock.method(models.Pasajero, 'findByPk', async () => ({ idUsuario: 20 }));
  const rooms = [];
  let emitido;
  const canal = { to(room) { rooms.push(room); return this; }, emit(evento) { emitido = evento; } };
  const io = { use() {}, on() {}, to: canal.to.bind(canal) };
  const eventos = require('../src/services/realtime')(io);
  await eventos.emit('pago_confirmado_reserva_1', { idReserva: 1, idViaje: 2 });
  assert.deepEqual(rooms, ['admins', 'usuario:10', 'usuario:20']);
  assert.equal(emitido, 'pago_confirmado_reserva_1');
});
