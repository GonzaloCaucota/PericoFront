const Auto = require('./../../src/models/auto.model'); 
const Chofer = require('./../../src/models/chofer.model');
const TurnoChofer = require('./../../src/models/turnoChofer');
const autoCtrl = {};

const validarAutoDelChoferAutenticado = async (req, idAuto) => {
    if (req.usuario.rol === 'ADMIN') return true;

    const chofer = await Chofer.findOne({
        where: {
            idUsuario: req.usuario.idUsuario
        }
    });

    if (!chofer) return false;

    const turno = await TurnoChofer.findOne({
        where: {
            idChofer: chofer.idChofer,
            idAuto
        }
    });

    return Boolean(turno);
};

// Obtener todos los autos
autoCtrl.getAutos = async (req, res) =>{
    /*
      #swagger.tags = ['Autos']
      #swagger.summary = 'Obtener todos los autos'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.responses[200] = { description: 'Lista de autos.', schema: [{ $ref: '#/definitions/Auto' }] }
    */
    try{
        const autos = await Auto.findAll()
        res.json(autos)
    }catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener los autos.' })
    }
}


// Obtener auto con sus choferes
autoCtrl.getAuto = async (req, res) => {
    /*
      #swagger.tags = ['Autos']
      #swagger.summary = 'Obtener un auto por ID'
      #swagger.description = 'Incluye los choferes asignados vía los turnos.'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID del auto.' }
      #swagger.responses[200] = { description: 'Auto encontrado.', schema: { $ref: '#/definitions/Auto' } }
      #swagger.responses[404] = { description: 'Auto no encontrado.' }
    */
    try {
       const auto = await Auto.findByPk(req.params.id,{
            include:'choferes' // Trae automáticamente los choferes y los datos del turno
       })
        if (!auto) {
            return res.status(404).json({ status: '0', msg: 'Auto no encontrado.' });
        }
        res.json(auto);
    } catch (error) {
        return res.status(500).json({ status: '0', msg: 'Error al buscar el auto.' });
    }
};


// Regristrar un nuevo auto
autoCtrl.createAuto = async (req, res) =>{
    /*
      #swagger.tags = ['Autos']
      #swagger.summary = 'Registrar un auto'
      #swagger.description = 'Requiere rol ADMIN.'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/Auto' } }
      #swagger.responses[200] = { description: 'Auto guardado.' }
      #swagger.responses[400] = { description: 'Error procesando operacion.' }
    */
    try{
        const auto = await Auto.create(req.body)
        res.json({ status: '1', msg: 'Auto guardado.', auto });
    }catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando operacion.', error: error.message });
    }
}


// Editar datos del auto
/*autoCtrl.editAuto = async (req,res) =>{
    try{
        await Auto.update(req.body, {
            where: { idAuto: req.body.id }
        });
        res.json({ status: '1', msg: 'Auto updated' });
    }  catch (error) {
    res.status(400).json({ status: '0', msg: 'Error procesando la operacion' });
    }
}*/

autoCtrl.editAuto = async (req, res) => {
  /*
    #swagger.tags = ['Autos']
    #swagger.summary = 'Editar un auto'
    #swagger.description = 'Requiere rol ADMIN.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID del auto.' }
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/Auto' } }
    #swagger.responses[200] = { description: 'Auto actualizado.' }
    #swagger.responses[404] = { description: 'Auto no encontrado.' }
  */
  try {
    if (!(await validarAutoDelChoferAutenticado(req, req.params.id))) {
      return res.status(403).json({
        status: '0',
        msg: 'No tenes permiso para modificar este auto.'
      });
    }

    const [actualizados] = await Auto.update(req.body, {
      where: {
        idAuto: req.params.id
      }
    });

    if (actualizados === 0) {
      return res.status(404).json({
        status: '0',
        msg: 'Auto no encontrado.'
      });
    }

    return res.status(200).json({
      status: '1',
      msg: 'Auto actualizado.'
    });
  } catch (error) {
    return res.status(400).json({
      status: '0',
      msg: 'Error procesando la operación.',
      error: error.message
    });
  }
};


// Cambiar estado del auto
autoCtrl.changeEstado = async (req, res) => {
    /*
      #swagger.tags = ['Autos']
      #swagger.summary = 'Cambiar estado del auto'
      #swagger.description = "Estados válidos: DISPONIBLE, EN_VIAJE, EN_TALLER, INACTIVO. Requiere rol ADMIN."
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID del auto.' }
      #swagger.parameters['body'] = { in: 'body', required: true, schema: { estado: 'DISPONIBLE' } }
      #swagger.responses[200] = { description: 'Estado del auto actualizado.' }
      #swagger.responses[400] = { description: 'Estado de auto no válido.' }
      #swagger.responses[404] = { description: 'Auto no encontrado.' }
    */
    try {
        const idAuto  = req.params.id;
        const estado  = req.body.estado;

        // Validacion
        const estadosValidos = ['DISPONIBLE', 'EN_VIAJE', 'EN_TALLER', 'INACTIVO'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ status: '0', msg: 'Estado de auto no válido.' });
        }

        const auto = await Auto.findByPk(idAuto);
        if (!auto) {
            return res.status(404).json({ status: '0', msg: 'Auto no encontrado.' });
        }

        if (!(await validarAutoDelChoferAutenticado(req, idAuto))) {
            return res.status(403).json({ status: '0', msg: 'No tenes permiso para modificar este auto.' });
        }

        auto.estado = estado;
        await auto.save(); // Guarda solo el cambio de estado

        return res.status(200).json({ status: '1', msg: 'Estado del auto actualizado.', auto });
    } catch (error) {
        return res.status(500).json({ status: '0', msg: 'Error al actualizar el estado.' });
    }
};


// Eliminar un auto
autoCtrl.deleteAuto = async (req, res) => {
    /*
      #swagger.tags = ['Autos']
      #swagger.summary = 'Eliminar un auto'
      #swagger.description = 'Requiere rol ADMIN.'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID del auto.' }
      #swagger.responses[200] = { description: 'Auto eliminado.' }
    */
    try {
        await Auto.destroy({
            where: { idAuto: req.params.id }
        });
        res.json({ status: '1', msg: 'Auto removed' });
    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando la operacion' });
    }
};


module.exports = autoCtrl;
