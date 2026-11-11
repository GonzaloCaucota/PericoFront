const express = require('express');
const adminCtrl = require('../controllers/admin.controller');
const authCtrl = require('../controllers/auth.controller');

const router = express.Router();

// Todo lo de administracion es exclusivo de rol ADMIN.
router.get('/dashboard', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), adminCtrl.getDashboard);
router.get('/', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), adminCtrl.obtenerAdmins);
router.post('/', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), adminCtrl.registrarAdmin);

const moderacion = require('../controllers/moderacion.controller');
router.use(authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'));
router.post('/choferes', require('../controllers/chofer.controller').registrarChofer);
router.post('/pasajeros', require('../controllers/pasajero.controller').registrarPasajero);
router.patch('/choferes/:idChofer/aprobar', moderacion.chofer('aprobar'));
router.patch('/choferes/:idChofer/bloquear', moderacion.chofer('bloquear'));
router.patch('/pasajeros/:idPasajero/activar', moderacion.pasajero('activar'));
router.patch('/pasajeros/:idPasajero/bloquear', moderacion.pasajero('bloquear'));
router.patch('/autos/:idAuto/habilitacion', moderacion.auto);

module.exports = router;