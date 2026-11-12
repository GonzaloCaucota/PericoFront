const { test } = require('node:test');
const assert = require('node:assert/strict');
const m = require('../src/models/relaciones');
const controller = require('../src/controllers/encuentro.controller');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
function setup(t, options = {}) {
  const transaction = {};
  const reserva = { idReserva: 4, idViaje: 3, idPasajero: 8, cantidadAsientos: 2, estadoReserva: 'CONFIRMADA', estadoPago: 'PENDIENTE', horarioEncuentro: new Date('2026-11-12T19:00:00Z'), encuentroConfirmadoAt: new Date('2026-11-12T18:30:00Z'), encuentroAceptadoPor: 7, ...options.reserva, save: async () => {} };
  const viaje = { idViaje: 3, idChofer: 2, idAuto: 1, fechaSalida: '2026-11-12', asientosDisponibles: 0, estadoViaje: 'COMPLETO', ...options.viaje, save: async () => {} };
  t.mock.method(m.sequelize, 'transaction', async fn => fn(transaction));
  t.mock.method(m.sequelize, 'query', async () => [[{ ahora: options.ahora || '2026-11-12T19:10:00Z' }]]);
  t.mock.method(m.Reserva, 'findByPk', async () => reserva);
  t.mock.method(m.Reserva, 'findOne', async () => reserva);
  t.mock.method(m.Viaje, 'findByPk', async (_id, opts) => { assert.equal(opts.lock.of, m.Viaje); assert.equal(opts.transaction, transaction); return viaje; });
  t.mock.method(m.Chofer, 'findByPk', async () => ({ idUsuario: 7 }));
  t.mock.method(m.Pasajero, 'findByPk', async () => ({ idUsuario: 20 }));
  t.mock.method(m.Auto, 'findByPk', async () => ({ capacidadAsientos: 4 }));
  t.mock.method(m.Invitado, 'findOne', async () => ({ idInvitado: 5 }));
  return { reserva, viaje };
}
async function run(accion, extra = {}, guest = false) {
  const res = response();
  await controller.gestionar(accion, guest)({ params: { idReserva: 4 }, usuario: accion === 'proponer' ? { rol: 'PASAJERO', idUsuario: 20 } : { rol: 'CHOFER', idUsuario: 7 }, body: {}, ...extra }, res, error => { throw error; });
  return res;
}
test('libera la reserva exactamente al cumplir 10 minutos y repetir no duplica asientos', async t => {
  const { reserva, viaje } = setup(t);
  const res = await run('ausencia');
  assert.equal(res.code, 200);
  assert.equal(reserva.estadoReserva, 'NO_PRESENTADO');
  assert.equal(reserva.noPresentadoPor, 7);
  assert.equal(viaje.asientosDisponibles, 2);
  assert.equal(viaje.estadoViaje, 'ABIERTO');
  await run('ausencia');
  assert.equal(viaje.asientosDisponibles, 2);
});
test('ni un segundo antes de la tolerancia permite liberar asientos', async t => {
  const { viaje } = setup(t, { ahora: '2026-11-12T19:09:59Z' });
  assert.equal((await run('ausencia')).code, 409);
  assert.equal(viaje.asientosDisponibles, 0);
});
test('sin aceptacion del chofer no se puede registrar ausencia', async t => {
  setup(t, { reserva: { encuentroConfirmadoAt: null } });
  assert.equal((await run('ausencia')).code, 409);
});
test('un chofer ajeno no puede modificar el horario ni liberar la reserva', async t => {
  setup(t);
  assert.equal((await run('ausencia', { usuario: { rol: 'CHOFER', idUsuario: 99 } })).code, 403);
});
test('una reserva pagada requiere administracion y no libera asientos', async t => {
  setup(t, { reserva: { estadoPago: 'PAGADO' } });
  assert.equal((await run('ausencia')).code, 409);
});
test('una nueva propuesta futura invalida la confirmacion anterior', async t => {
  const { reserva } = setup(t);
  assert.equal((await run('proponer', { body: { horarioEncuentro: '2026-11-12T16:30:00-03:00' } })).code, 200);
  assert.equal(reserva.encuentroConfirmadoAt, null);
});
test('no permite proponer un horario pasado ni de otro dia', async t => {
  setup(t);
  for (const horarioEncuentro of ['2026-11-12T15:00:00-03:00', '2026-11-13T16:00:00-03:00']) {
    assert.equal((await run('proponer', { body: { horarioEncuentro } })).code, 400);
  }
});
test('el pasajero no puede aceptar su propia propuesta', async t => {
  setup(t);
  assert.equal((await run('confirmar', { usuario: { rol: 'PASAJERO', idUsuario: 20 }, body: { horarioEncuentro: '2026-11-12T19:00:00Z' } })).code, 403);
});
test('el chofer acepta solo la version de horario que vio', async t => {
  setup(t, { reserva: { horarioEncuentro: new Date('2026-11-12T19:30:00Z'), encuentroConfirmadoAt: null } });
  const usuario = { rol: 'CHOFER', idUsuario: 7 };
  assert.equal((await run('confirmar', { usuario, body: { horarioEncuentro: '2026-11-12T19:25:00Z' } })).code, 409);
  assert.equal((await run('confirmar', { usuario, body: { horarioEncuentro: '2026-11-12T19:30:00Z' } })).code, 200);
});
test('un invitado propone con su comprobante y no puede aceptar por el chofer', async t => {
  setup(t, { reserva: { horarioEncuentro: new Date('2026-11-12T19:30:00Z'), encuentroConfirmadoAt: null } });
  const headers = { 'x-reserva-token': 'a'.repeat(64) };
  const res = await run('proponer', { headers, body: { horarioEncuentro: '2026-11-12T19:30:00Z' } }, true);
  assert.equal(res.code, 200);
  assert.equal(JSON.stringify(res.body).includes('tokenHash'), false);
  assert.equal((await run('confirmar', { headers }, true)).code, 403);
  assert.equal((await run('proponer', { headers: {} }, true)).code, 401);
});
test('una reserva cancelada o un viaje finalizado no admiten ausencia', async t => {
  setup(t, { viaje: { estadoViaje: 'FINALIZADO' } });
  assert.equal((await run('ausencia')).code, 409);
});
test('el endpoint generico no permite al chofer saltarse la tolerancia cancelando', async () => {
  const res = response();
  await require('../src/controllers/reserva.controller').cambiarEstadoReserva({ usuario: { rol: 'CHOFER', idUsuario: 7 }, body: { estado: 'CANCELADA' } }, res);
  assert.equal(res.code, 409);
});
test('no se puede cobrar una reserva liberada por ausencia', async t => {
  setup(t, { reserva: { estadoReserva: 'NO_PRESENTADO' } });
  const res = response();
  await require('../src/controllers/reserva.controller').registrarPagoEfectivo({ params: { idReserva: 4 } }, res);
  assert.equal(res.code, 409);
});

test('el chofer no puede proponer el horario del pasajero', async t => {
  setup(t);
  assert.equal((await run('proponer', { usuario: { rol: 'CHOFER', idUsuario: 7 }, body: { horarioEncuentro: '2026-11-12T19:30:00Z' } })).code, 403);
});
