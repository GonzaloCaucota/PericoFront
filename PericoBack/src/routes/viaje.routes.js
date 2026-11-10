// defino controlador para el manejo de CRUD de Viajes
const viajeCtrl = require('../controllers/viaje.controller');
const authCtrl = require('../controllers/auth.controller');
// creamos el manejador de rutas
const express = require('express');
const router = express.Router();

// Las rutas definen el contrato HTTP. verifyToken autentica y verificarRol limita acciones sensibles.
// Consultar viajes: cualquier usuario logueado (el pasajero necesita ver los disponibles).
router.get('/', authCtrl.verifyToken, viajeCtrl.getViajes);
router.get('/disponibles', authCtrl.verifyToken, viajeCtrl.getViajesDisponibles);
router.get('/:id', authCtrl.verifyToken, viajeCtrl.getViaje);

// Actualizar asientos: ADMIN o CHOFER desde el panel (pasajero manual/transeunte).
router.post('/:id/actualizar-asientos-disponibles', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'CHOFER'), viajeCtrl.actualizarAsientosDisponibles);

// Crear viajes: ADMIN o CHOFER desde su panel.
router.post('/', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'CHOFER'), viajeCtrl.createViaje);
router.put('/:id', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), viajeCtrl.editViaje);
router.delete('/:id', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), viajeCtrl.deleteViaje);

// Cambiar estado del viaje (iniciar/finalizar): ADMIN o el chofer asignado (se valida adentro del controller).
router.patch('/:id/estado', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'CHOFER'), viajeCtrl.changeEstado);

// exportamos el modulo de rutas
module.exports = router;
