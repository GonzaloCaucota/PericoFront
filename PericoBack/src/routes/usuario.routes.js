const express = require('express');
const usuarioController = require('../controllers/usuario.controller');
const authCtrl = require('../controllers/auth.controller');

const router = express.Router();

router.get('/', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), usuarioController.obtenerUsuarios);
router.post('/login', usuarioController.login);
router.post('/login-google', usuarioController.loginGoogle);

module.exports = router;