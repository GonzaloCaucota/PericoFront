const TurnoChofer = require('../models/turnoChofer'); 
const Auto = require('../models/auto.model');
const Chofer = require('../models/chofer.model');
const turnoChoferCtrl = {};

// Registrar nuevo turno
turnoChoferCtrl.createTurno = async (req, res) => {
    /*
      #swagger.tags = ['Turnos']
      #swagger.summary = 'Registrar un turno chofer-auto'
      #swagger.description = 'Requiere rol ADMIN.'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/TurnoChofer' } }
      #swagger.responses[200] = { description: 'Turno guardado.' }
      #swagger.responses[400] = { description: 'Error procesando operacion.' }
    */
    try {
        if (req.usuario.rol !== 'ADMIN') {
            const chofer = await Chofer.findByPk(req.body.idChofer);
            if (!chofer || chofer.idUsuario !== req.usuario.idUsuario) {
                return res.status(403).json({
                    status: '0',
                    msg: 'No tenes permiso para asignar autos a este chofer.'
                });
            }
        }

        // req.body debe recibir: idAuto, idChofer, fecha, horaInicio, horaFin
        const nuevoTurno = await TurnoChofer.create(req.body);

        res.json({ status: '1', msg: 'Turno guardado.' });
    }catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando operacion.' });
    }
};


// Obtener todos los turnos
turnoChoferCtrl.getTurnos = async (req,res) =>{
    /*
      #swagger.tags = ['Turnos']
      #swagger.summary = 'Obtener todos los turnos'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.responses[200] = { description: 'Lista de turnos.', schema: [{ $ref: '#/definitions/TurnoChofer' }] }
    */
    try{
        const turnos = await TurnoChofer.findAll()
        res.json(turnos)
    }catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener los turnos.' })
    }
}


// Editar datos del turno 

turnoChoferCtrl.editTurno = async (req, res) => {
  /*
    #swagger.tags = ['Turnos']
    #swagger.summary = 'Editar un turno'
    #swagger.description = 'Requiere rol ADMIN.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID del turno.' }
    #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/TurnoChofer' } }
    #swagger.responses[200] = { description: 'Turno actualizado.' }
    #swagger.responses[404] = { description: 'Turno no encontrado.' }
  */
  try {
    const [actualizados] = await TurnoChofer.update(req.body, {
      where: {
        idTurnoChofer: req.params.id
      }
    });

    if (actualizados === 0) {
      return res.status(404).json({
        status: '0',
        msg: 'Turno no encontrado.'
      });
    }

    return res.status(200).json({
      status: '1',
      msg: 'Turno actualizado.'
    });
  } catch (error) {
    return res.status(400).json({
      status: '0',
      msg: 'Error procesando la operación.',
      error: error.message
    });
  }
};
// Eliminar turno
/*turnoChoferCtrl.deleteTurno = async (req,res) =>{
    try {
        await TurnoChofer.destroy({
            where: { id: req.params.id }
        });
        res.json({ status: '1', msg: 'Turno removed' });

    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando la operacion' });
    }
}*/

turnoChoferCtrl.deleteTurno = async (req, res) => {
  /*
    #swagger.tags = ['Turnos']
    #swagger.summary = 'Eliminar un turno'
    #swagger.description = 'Requiere rol ADMIN.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID del turno.' }
    #swagger.responses[200] = { description: 'Turno eliminado.' }
    #swagger.responses[404] = { description: 'Turno no encontrado.' }
  */
  try {
    const eliminados = await TurnoChofer.destroy({
      where: {
        idTurnoChofer: req.params.id
      }
    });

    if (eliminados === 0) {
      return res.status(404).json({
        status: '0',
        msg: 'Turno no encontrado.'
      });
    }

    return res.status(200).json({
      status: '1',
      msg: 'Turno eliminado.'
    });
  } catch (error) {
    return res.status(400).json({
      status: '0',
      msg: 'Error procesando la operación.',
      error: error.message
    });
  }
};


module.exports = turnoChoferCtrl;
