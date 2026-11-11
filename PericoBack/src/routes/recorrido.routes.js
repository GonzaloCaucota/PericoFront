const router = require('express').Router();
router.get('/', require('../controllers/recorrido.controller').listar);
module.exports = router;
