//defino controlador para el manejo de CRUD
const turnoChoferCtrl = require('../controllers/turnoChofer.controller');
const authCtrl = require('../controllers/auth.controller');
//creamos el manejador de rutas
const express = require('express');
const router = express.Router();
//definimos las rutas para la gestion de agente

// Consultar turnos: cualquier usuario logueado.
router.get('/', authCtrl.verifyToken, turnoChoferCtrl.getTurnos);

// Asignar autos al chofer: ADMIN o CHOFER desde su panel.
router.post('/', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN', 'CHOFER'), turnoChoferCtrl.createTurno);
router.put('/:id', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), turnoChoferCtrl.editTurno);
router.delete('/:id', authCtrl.verifyToken, authCtrl.verificarRol('ADMIN'), turnoChoferCtrl.deleteTurno);

//exportamos el modulo de rutas
module.exports = router;
