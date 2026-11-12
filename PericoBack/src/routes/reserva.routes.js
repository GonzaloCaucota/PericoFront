const express = require('express');
const reservaCtrl = require('../controllers/reserva.controller');
const authCtrl = require('../controllers/auth.controller');

const router = express.Router();
const invitado = require('../controllers/reserva-invitado.controller');
const encuentro = require('../controllers/encuentro.controller');
router.patch('/invitado/encuentro/confirmar', encuentro.gestionar('confirmar', true));
router.patch('/:idReserva/encuentro', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'CHOFER'), encuentro.gestionar('proponer'));
router.patch('/:idReserva/encuentro/confirmar', authCtrl.verifyToken, authCtrl.verificarRol('PASAJERO'), encuentro.gestionar('confirmar'));
router.patch('/:idReserva/no-presentado', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'CHOFER'), encuentro.gestionar('ausencia'));
// Limite local por IP para evitar rafagas sobre el formulario publico.
const intentosInvitado = new Map();
router.post('/invitado', (req, res, next) => {
  const ahora = Date.now();
  for (const [ip, item] of intentosInvitado) if (item.hasta < ahora) intentosInvitado.delete(ip);
  const key = req.ip;
  const item = intentosInvitado.get(key) || { veces: 0, hasta: ahora + 60000 };
  if (item.veces >= 10 || intentosInvitado.size >= 10000) return res.status(429).json({ mensaje: 'Demasiados intentos. Espera un minuto y vuelve a intentar.' });
  item.veces++; intentosInvitado.set(key, item); next();
}, invitado.crear);
router.patch('/invitado/ubicacion', invitado.ubicacion);
router.get('/invitado', invitado.gestionar(false));
router.patch('/invitado/cancelar', invitado.gestionar(true));

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
