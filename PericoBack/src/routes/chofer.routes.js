const express = require('express');
const choferCtrl = require('../controllers/chofer.controller');
const authCtrl = require('../controllers/auth.controller');

const router = express.Router();
const propietario = authCtrl.propietarioPerfil(require('../models/chofer.model'), 'idChofer');

router.get('/', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), choferCtrl.obtenerChoferes);
router.post('/', choferCtrl.registrarChofer);

// Frontend: trae datos completos del chofer.
router.get('/:idChofer/estadisticas', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'CHOFER'), propietario, require('../controllers/estadisticas.controller').obtener('choferes'));

router.get('/:idChofer', authCtrl.verifyToken, propietario, choferCtrl.obtenerChoferPorId);

// Frontend: cambia el estado del chofer (DISPONIBLE, DESCANSO, EN_VIAJE, etc.).
router.patch('/:idChofer/estado', authCtrl.verifyToken, propietario, choferCtrl.cambiarEstadoChofer);

// Frontend: actualiza la ubicacion actual del chofer.
router.patch('/:idChofer/ubicacion', authCtrl.verifyToken, propietario, choferCtrl.actualizarUbicacionChofer);

// Frontend: trae todos los autos relacionados a ese chofer.
router.get('/:idChofer/autos', authCtrl.verifyToken, propietario, choferCtrl.obtenerAutosDelChofer);

// Frontend: trae los viajes del boton "Ver Mis Viajes".
router.get('/:idChofer/viajes', authCtrl.verifyToken, propietario, choferCtrl.obtenerViajesDelChofer);

// Frontend: actualiza los datos del chofer (incluye password).
router.patch('/:idChofer', authCtrl.verifyToken, propietario, choferCtrl.actualizarChofer);

module.exports = router;
