const { test } = require('node:test');
const assert = require('node:assert/strict');
const m = require('../src/models/relaciones');
const ctrl = require('../src/controllers/viaje.controller');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
function setup(t, { libres = 0, reservados = 2, estado = 'ABIERTO', usuario = 7 } = {}) {
  const transaction = {};
  const viaje = { idViaje: 3, idChofer: 2, asientosDisponibles: libres, estadoViaje: estado, auto: { capacidadAsientos: 4 }, save: async options => assert.equal(options.transaction, transaction) };
  t.mock.method(m.sequelize, 'transaction', async callback => callback(transaction));
  let reads = 0;
  t.mock.method(m.Viaje, 'findByPk', async (_id, options) => {
    assert.equal(options.transaction, transaction);
    if (reads++ === 0) assert.equal(options.lock.of, m.Viaje);
    return viaje;
  });
  t.mock.method(m.Chofer, 'findByPk', async () => ({ idUsuario: usuario }));
  t.mock.method(m.Reserva, 'sum', async (_field, options) => {
    assert.equal(options.transaction, transaction);
    assert.deepEqual(options.where.estadoReserva[require('sequelize').Op.notIn], ['CANCELADA', 'NO_PRESENTADO']);
    return reservados;
  });
  return viaje;
}
const request = body => ({ params: { id: 3 }, usuario: { rol: 'CHOFER', idUsuario: 7 }, body });
test('quita un manual, libera un asiento y reabre un viaje completo', async t => {
  const viaje = setup(t, { estado: 'COMPLETO' });
  const res = response();
  let evento;
  await ctrl.actualizarAsientosDisponibles({ ...request({ accionManual: 'QUITAR' }), io: { emit: (...args) => { evento = args; } } }, res);
  assert.equal(res.code, 200);
  assert.equal(viaje.asientosDisponibles, 1);
  assert.equal(viaje.estadoViaje, 'ABIERTO');
  assert.equal(evento[0], 'asientos_actualizados_viaje_3');
});
test('no libera asientos reservados cuando no hay pasajeros manuales', async t => {
  const viaje = setup(t, { libres: 2, reservados: 2 });
  const res = response();
  await ctrl.actualizarAsientosDisponibles(request({ accionManual: 'QUITAR' }), res);
  assert.equal(res.code, 409);
  assert.equal(viaje.asientosDisponibles, 2);
});
test('agrega sobre la disponibilidad actual y conserva las reservas', async t => {
  const viaje = setup(t, { libres: 2 });
  const res = response();
  await ctrl.actualizarAsientosDisponibles(request({ accionManual: 'AGREGAR' }), res);
  assert.equal(res.code, 200);
  assert.equal(viaje.asientosDisponibles, 1);
});
test('rechaza agregar cuando el viaje esta lleno', async t => {
  setup(t);
  const res = response();
  await ctrl.actualizarAsientosDisponibles(request({ accionManual: 'AGREGAR' }), res);
  assert.equal(res.code, 409);
});
test('otro chofer no puede quitar pasajeros', async t => {
  setup(t, { usuario: 99 });
  const res = response();
  await ctrl.actualizarAsientosDisponibles(request({ accionManual: 'QUITAR' }), res);
  assert.equal(res.code, 403);
});
test('un viaje finalizado no admite cambios manuales', async t => {
  setup(t, { estado: 'FINALIZADO' });
  const res = response();
  await ctrl.actualizarAsientosDisponibles(request({ accionManual: 'QUITAR' }), res);
  assert.equal(res.code, 409);
});
test('el endpoint anterior tampoco permite liberar reservas ni superar la capacidad', async t => {
  setup(t, { libres: 1, reservados: 2 });
  for (const asientosDisponibles of [3, 5]) {
    const res = response();
    await ctrl.actualizarAsientosDisponibles(request({ asientosDisponibles }), res);
    assert.equal(res.code, 409);
  }
});
