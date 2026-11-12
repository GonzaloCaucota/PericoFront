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
      #swagger.description = 'ADMIN o CHOFER. Crea y asocia el auto al chofer autenticado en una transaccion.'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/Auto' } }
      #swagger.responses[201] = { description: 'Auto guardado.' }
      #swagger.responses[400] = { description: 'Error procesando operacion.' }
    */
    try {
        const { sequelize } = require('../models/relaciones');
        const fallo = (status, message) => Object.assign(new Error(message), { status });
        const patente = typeof req.body.patente === 'string' ? req.body.patente.trim().toUpperCase() : '';
        const marca = typeof req.body.marca === 'string' ? req.body.marca.trim() : '';
        const modelo = typeof req.body.modelo === 'string' ? req.body.modelo.trim() : '';
        const capacidadAsientos = Number(req.body.capacidadAsientos);
        const estado = req.body.estado ?? 'DISPONIBLE';
        if (!patente || !marca || !modelo || [patente, marca, modelo].some(v => v.length > 255)
            || !Number.isSafeInteger(capacidadAsientos) || capacidadAsientos < 1
            || !['DISPONIBLE', 'EN_VIAJE', 'EN_TALLER', 'INACTIVO'].includes(estado)) throw fallo(400, 'Completa los datos del auto y una capacidad entera positiva.');
        let asociadoAlChofer = false;
        const auto = await sequelize.transaction(async transaction => {
            let chofer;
            if (req.usuario.rol === 'CHOFER') {
                chofer = await Chofer.findOne({ where: { idUsuario: req.usuario.idUsuario }, transaction, lock: true });
                if (!chofer) throw fallo(404, 'No se encontro tu perfil de chofer.');
                if (req.body.idChofer != null && Number(req.body.idChofer) !== chofer.idChofer) throw fallo(403, 'No podes asignar autos a otro chofer.');
            } else if (req.body.idChofer != null) {
                if (!Number.isSafeInteger(Number(req.body.idChofer)) || Number(req.body.idChofer) < 1) throw fallo(400, 'Selecciona un chofer valido.');
                chofer = await Chofer.findByPk(Number(req.body.idChofer), { transaction, lock: true });
                if (!chofer) throw fallo(404, 'Chofer no encontrado.');
            }
            if (await Auto.findOne({ where: { patente }, transaction })) throw fallo(409, 'La patente ya esta registrada. Edita el auto existente o solicita su asignacion a administracion.');
            const creado = await Auto.create({ patente, marca, modelo, capacidadAsientos, estado }, { transaction });
            if (chofer) {
                const [[{ hoy }]] = await sequelize.query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Jujuy')::date::text AS hoy", { transaction });
                await TurnoChofer.create({ idChofer: chofer.idChofer, idAuto: creado.idAuto, fecha: hoy, horaInicio: '00:00:00', horaFin: '23:59:59' }, { transaction });
                asociadoAlChofer = true;
            }
            return creado;
        });
        return res.status(201).json({ status: '1', msg: 'Auto registrado.', auto, asociadoAlChofer });
    } catch (error) {
        const duplicado = error.name === 'SequelizeUniqueConstraintError';
        return res.status(error.status || (duplicado ? 409 : 400)).json({ status: '0', msg: error.status ? error.message
            : duplicado ? 'La patente o el identificador ya existe. Administracion debe revisar el alta.'
            : 'No se pudo registrar y asociar el auto. No se guardaron cambios.' });
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

    const actual = await Auto.findByPk(req.params.id);
    if (req.usuario.rol !== 'ADMIN' && actual?.estado === 'INACTIVO') return res.status(403).json({ msg: 'Solo administracion puede modificar un vehiculo deshabilitado.' });
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

        if (req.usuario.rol !== 'ADMIN' && auto.estado === 'INACTIVO') return res.status(403).json({ msg: 'Solo administracion puede rehabilitar este vehiculo.' });
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
