const express = require('express');
const pasajeroCtrl = require('../controllers/pasajero.controller');
const authCtrl = require('../controllers/auth.controller');

const router = express.Router();
const propietario = authCtrl.propietarioPerfil(require('../models/pasajero.model'), 'idPasajero');

router.get('/', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), pasajeroCtrl.obtenerPasajeros);
router.get('/:idPasajero/historial', authCtrl.verifyToken, propietario, pasajeroCtrl.obtenerHistorialPasajero);
router.patch('/:idPasajero/ubicacion', authCtrl.verifyToken, propietario, pasajeroCtrl.actualizarUbicacionPasajero);
router.get('/:idPasajero', authCtrl.verifyToken, propietario, pasajeroCtrl.obtenerPasajero);
router.post('/', pasajeroCtrl.registrarPasajero);
router.patch('/:idPasajero', authCtrl.verifyToken, propietario, pasajeroCtrl.actualizarPasajero);

module.exports = router;
