const express = require('express');
const reservaCtrl = require('../controllers/reserva.controller');
const authCtrl = require('../controllers/auth.controller');

const router = express.Router();

// Listado completo de reservas: exclusivo de ADMIN.
router.get('/', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), reservaCtrl.obtenerReservas);

// Crear reserva: PASAJERO (para si mismo) o ADMIN.
router.post('/', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'PASAJERO'), reservaCtrl.registrarReserva);

// Cambiar estado (confirmar, marcar utilizada, etc): ADMIN o CHOFER del viaje.
router.patch('/:idReserva/estado', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'CHOFER'), authCtrl.choferReserva, reservaCtrl.cambiarEstadoReserva);

// Cancelar: ADMIN o el propio PASAJERO dueno de la reserva (se valida adentro del controller).
router.patch('/:idReserva/cancelar', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'PASAJERO'), reservaCtrl.cancelarReserva);

// Registrar pago en efectivo: lo hace el CHOFER al recibir el pago, o ADMIN.
router.put('/:idReserva/pago-efectivo', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'CHOFER'), authCtrl.choferReserva, reservaCtrl.registrarPagoEfectivo);

module.exports = router;
