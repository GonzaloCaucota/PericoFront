const express = require('express');
const adminCtrl = require('../controllers/admin.controller');
const authCtrl = require('../controllers/auth.controller');

const router = express.Router();

// Todo lo de administracion es exclusivo de rol ADMIN.
router.get('/dashboard', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), adminCtrl.getDashboard);
router.get('/', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), adminCtrl.obtenerAdmins);
router.post('/', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), adminCtrl.registrarAdmin);

module.exports = router;