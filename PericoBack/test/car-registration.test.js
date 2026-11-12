const { test } = require('node:test');
const assert = require('node:assert/strict');
const m = require('../src/models/relaciones');
const ctrl = require('../src/controllers/auto.controller');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const req = body => ({ usuario: { rol: 'CHOFER', idUsuario: 7 }, body: { patente: ' ab123cd ', marca: 'Fiat', modelo: 'Cronos', capacidadAsientos: 4, ...body } });
function setup(t) {
 const transaction = {};
 t.mock.method(m.sequelize, 'transaction', async fn => fn(transaction));
 t.mock.method(m.Chofer, 'findOne', async () => ({ idChofer: 3 }));
 t.mock.method(m.Auto, 'findOne', async () => null);
 t.mock.method(m.sequelize, 'query', async () => [[{ hoy: '2026-11-12' }]]);
 return transaction;
}
test('crea auto y asociacion en la misma transaccion usando identidad del token', async t => {
 const transaction = setup(t);
 t.mock.method(m.Auto, 'create', async (data, options) => { assert.equal(options.transaction, transaction); assert.equal(data.patente, 'AB123CD'); assert.equal(data.idAuto, undefined); return { idAuto: 8, ...data }; });
 t.mock.method(m.TurnoChofer, 'create', async (data, options) => { assert.equal(options.transaction, transaction); assert.equal(data.idChofer, 3); assert.equal(data.idAuto, 8); });
 const res = response(); await ctrl.createAuto(req({ idAuto: 1234 }), res); assert.equal(res.code, 201); assert.equal(res.body.asociadoAlChofer, true);
});
test('el fallo de asociacion aborta la transaccion sin devolver exito parcial', async t => {
 setup(t); let aborto = false;
 t.mock.method(m.sequelize, 'transaction', async fn => { try { return await fn({}); } catch(e) { aborto = true; throw e; } });
 t.mock.method(m.Auto, 'create', async () => ({ idAuto: 8 }));
 t.mock.method(m.TurnoChofer, 'create', async () => { throw Error('Fallo simulado'); });
 const res = response(); await ctrl.createAuto(req(), res); assert.equal(aborto, true); assert.equal(res.code, 400); assert.equal(res.body.auto, undefined);
});
test('no permite asignar a otro chofer', async t => {
 setup(t); const res = response(); await ctrl.createAuto(req({ idChofer: 99 }), res); assert.equal(res.code, 403);
});
test('no sobrescribe patentes existentes', async t => {
 setup(t); t.mock.method(m.Auto, 'findOne', async () => ({ idAuto: 8 }));
 const res = response(); await ctrl.createAuto(req(), res); assert.equal(res.code, 409);
});
test('el perfil propio consulta la identidad del token sin listar otros choferes', async t => {
 t.mock.method(m.Chofer, 'findOne', async options => { assert.deepEqual(options.where, { idUsuario: 7 }); assert.deepEqual(options.attributes, ['idChofer']); return { idChofer: 3 }; });
 const res = response(); await require('../src/controllers/chofer.controller').obtenerMiPerfil({ usuario: { idUsuario: 7 } }, res); assert.deepEqual(res.body, { idChofer: 3 });
});
