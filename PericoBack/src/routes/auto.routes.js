//defino controlador para el manejo de CRUD
const autoCtrl = require('../controllers/auto.controller');
const authCtrl = require('../controllers/auth.controller');
//creamos el manejador de rutas
const express = require('express');
const router = express.Router();
//definimos las rutas para la gestion de agente

// Consultar autos: cualquier usuario logueado (admin y chofer los necesitan ver).
router.get('/', authCtrl.verifyToken, autoCtrl.getAutos);
router.get('/:id', authCtrl.verifyToken, autoCtrl.getAuto);

// Gestion de autos: ADMIN o CHOFER desde su panel.
router.post('/', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'CHOFER'), autoCtrl.createAuto);
router.put('/:id', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'CHOFER'), autoCtrl.editAuto);
router.patch('/:id/estado', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'CHOFER'), autoCtrl.changeEstado);
router.delete('/:id', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), autoCtrl.deleteAuto);

//exportamos el modulo de rutas
module.exports = router;
