const { Op } = require('sequelize');
const { sequelize, Usuario, Chofer, Auto, Viaje, Admin, HabilitacionChofer } = require('../models/relaciones');

const choferCtrl = {};

// El chofer modifica sus propios datos (perfil Usuario + perfil Chofer).
choferCtrl.actualizarChofer = async (req, res) => {
  /*
    #swagger.tags = ['Choferes']
    #swagger.summary = 'Actualizar chofer'
    #swagger.description = 'Actualiza los datos de Usuario y del perfil Chofer. Solo se modifican los campos enviados.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['idChofer'] = { in: 'path', required: true, type: 'integer', description: 'ID del chofer.' }
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: { $ref: '#/definitions/Chofer' }
    }
    #swagger.responses[200] = { description: 'Chofer actualizado correctamente.' }
    #swagger.responses[404] = { description: 'Chofer no encontrado.' }
  */
  if (req.usuario.rol !== 'ADMIN' && ['activo', 'estadoPasajero', 'calificacion', 'cantidadReservas', 'estadoChofer'].some(campo => req.body[campo] !== undefined)) {
    return res.status(403).json({ mensaje: 'Solo administracion puede modificar estos campos' });
  }
  if (req.body.activo !== undefined || req.body.estadoChofer !== undefined) return res.status(400).json({ mensaje: 'Usa las acciones administrativas de aprobar, habilitar o bloquear para cambiar el acceso.' });
  const {
    nombre,
    apellido,
    email,
    telefono,
    activo,
    password,
    licenciaConducir,
    fechaHabilitacion,
    estadoChofer,
  } = req.body;

  const transaction = await sequelize.transaction();

  try {
    const chofer = await Chofer.findByPk(req.params.idChofer, {
      include: [{ model: Usuario, as: 'usuario' }],
      transaction,
    });

    if (!chofer) {
      await transaction.rollback();
      return res.status(404).json({
        status: '0',
        msg: 'Chofer no encontrado.',
      });
    }

    const usuario = chofer.usuario;
    if (req.usuario.rol === 'ADMIN' && (activo === true || ['DISPONIBLE', 'EN_VIAJE', 'DESCANSO'].includes(estadoChofer))) {
      const habilitacion = await HabilitacionChofer.findByPk(chofer.idChofer, { transaction });
      if (habilitacion?.estado !== 'APROBADO') {
        await transaction.rollback();
        return res.status(409).json({ mensaje: 'Usa Aprobar alta para habilitar un chofer pendiente.' });
      }
    }

    // Solo se actualizan los campos que el cliente mando en el body.
    if (nombre !== undefined) usuario.nombre = nombre;
    if (apellido !== undefined) usuario.apellido = apellido;
    if (email !== undefined) usuario.email = email;
    if (telefono !== undefined) usuario.telefono = telefono;
    if (activo !== undefined) usuario.activo = activo;

    // Si mandan "password", se reasigna passwordHash: el hook beforeUpdate
    // del modelo Usuario se encarga de hashearla con bcrypt automaticamente.
    if (password !== undefined && password !== '') {
      usuario.passwordHash = password;
    }

    await usuario.save({ transaction });

    if (licenciaConducir !== undefined) chofer.licenciaConducir = licenciaConducir;
    if (fechaHabilitacion !== undefined) chofer.fechaHabilitacion = fechaHabilitacion;
    if (estadoChofer !== undefined) chofer.estadoChofer = estadoChofer;

    await chofer.save({ transaction });

    await transaction.commit();
    if (req.usuario?.rol === 'ADMIN') req.io?.desconectarUsuario?.(usuario.idUsuario);

    return res.status(200).json({
      status: '1',
      msg: 'Chofer actualizado correctamente.',
      usuario: quitarPassword(usuario),
      chofer,
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(400).json({
      status: '0',
      msg: 'No se pudo actualizar el chofer.',
      error: error.message,
    });
  }
};

// Evita devolver el passwordHash en las respuestas del servidor.
const quitarPassword = (usuario) => {
  const usuarioSinPassword = usuario.toJSON();
  delete usuarioSinPassword.passwordHash;

  return usuarioSinPassword;
};

const validarUbicacion = (latitud, longitud, precision) => {
  const latitudNumero = Number(latitud);
  const longitudNumero = Number(longitud);
  const precisionNumero = precision !== undefined && precision !== null ? Number(precision) : null;

  if (!Number.isFinite(latitudNumero) || latitudNumero < -90 || latitudNumero > 90) {
    return { error: 'Latitud no valida.' };
  }

  if (!Number.isFinite(longitudNumero) || longitudNumero < -180 || longitudNumero > 180) {
    return { error: 'Longitud no valida.' };
  }

  if (precisionNumero !== null && (!Number.isFinite(precisionNumero) || precisionNumero < 0)) {
    return { error: 'Precision no valida.' };
  }

  return {
    ubicacion: {
      latitud: latitudNumero,
      longitud: longitudNumero,
      precision: precisionNumero,
    },
  };
};

choferCtrl.registrarChofer = async (req, res) => {
  /*
    #swagger.tags = ['Choferes']
    #swagger.summary = 'Registrar un chofer'
    #swagger.description = 'Crea un Usuario con rol CHOFER y su perfil Chofer asociado. Ruta pública (registro).'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: { $ref: '#/definitions/Usuario' }
    }
    #swagger.responses[201] = { description: 'Chofer registrado correctamente.' }
    #swagger.responses[400] = { description: 'No se pudo registrar el chofer.' }
  */
  const {
    nombre,
    apellido,
    email,
    passwordHash,
    telefono,
    activo,
    licenciaConducir,
    estadoChofer,
    fechaHabilitacion,
    calificacion,
  } = req.body;

  const transaction = await sequelize.transaction();

  try {
    // Primero se crea el Usuario con los datos comunes.
    const usuario = await Usuario.create(
      {
        nombre,
        apellido,
        email,
        passwordHash,
        telefono,
        activo: req.usuario?.rol === 'ADMIN',
        rol: 'CHOFER',
      },
      { transaction }
    );

    // Luego se crea el perfil Chofer asociado al Usuario.
    const chofer = await Chofer.create(
      {
        idUsuario: usuario.idUsuario,
        licenciaConducir,
        estadoChofer: req.usuario?.rol === 'ADMIN' ? 'DISPONIBLE' : 'INACTIVO',
        fechaHabilitacion,
        calificacion: 0,
      },
      { transaction }
    );

    if (req.usuario?.rol === 'ADMIN') {
      const administrador = await Admin.findOne({ where: { idUsuario: req.usuario.idUsuario }, transaction });
      const habilitacion = await HabilitacionChofer.findByPk(chofer.idChofer, { transaction });
      habilitacion.estado = 'APROBADO';
      habilitacion.idAdmin = administrador.idAdmin;
      habilitacion.fechaDecision = new Date();
      habilitacion.motivo = 'Alta directa por administrador';
      await habilitacion.save({ transaction });
    }
    await transaction.commit();

    return res.status(201).json({
      mensaje: req.usuario?.rol === 'ADMIN' ? 'Chofer dado de alta y aprobado.' : 'Solicitud recibida. Un administrador debe aprobar tu cuenta antes de ingresar.',
      usuario: quitarPassword(usuario),
      chofer,
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(400).json({
      mensaje: 'No se pudo registrar el chofer',
      error: error.message,
    });
  }
};

choferCtrl.obtenerChoferes = async (req, res) => {
  /*
    #swagger.tags = ['Choferes']
    #swagger.summary = 'Obtener todos los choferes'
    #swagger.description = 'Requiere rol ADMIN.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = {
      description: 'Lista de choferes.',
      schema: [{ $ref: '#/definitions/Chofer' }]
    }
  */
  try {
    // Trae los choferes junto con los datos del usuario relacionado.
    const choferes = await Chofer.findAll({
      include: [
        { association: 'habilitacion' },
        {
          model: Usuario,
          as: 'usuario',
          attributes: { exclude: ['passwordHash'] },
        },
      ],
    });

    return res.status(200).json(choferes);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener los choferes',
      error: error.message,
    });
  }
};

// Trae los datos completos de un chofer puntual junto con su usuario.
choferCtrl.obtenerChoferPorId = async (req, res) => {
  /*
    #swagger.tags = ['Choferes']
    #swagger.summary = 'Obtener un chofer por ID'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['idChofer'] = { in: 'path', required: true, type: 'integer', description: 'ID del chofer.' }
    #swagger.responses[200] = { description: 'Chofer encontrado.', schema: { $ref: '#/definitions/Chofer' } }
    #swagger.responses[404] = { description: 'Chofer no encontrado.' }
  */
  try {
    const chofer = await Chofer.findByPk(req.params.idChofer, {
      include: [
        { association: 'habilitacion' },
        {
          model: Usuario,
          as: 'usuario',
          attributes: { exclude: ['passwordHash'] },
        },
      ],
    });

    if (!chofer) {
      return res.status(404).json({
        status: '0',
        msg: 'Chofer no encontrado.',
      });
    }

    return res.status(200).json(chofer);
  } catch (error) {
    return res.status(500).json({
      status: '0',
      msg: 'Error al obtener el chofer.',
      error: error.message,
    });
  }
};

// Cambia solo el estado operativo del chofer.
choferCtrl.cambiarEstadoChofer = async (req, res) => {
  /*
    #swagger.tags = ['Choferes']
    #swagger.summary = 'Cambiar estado del chofer'
    #swagger.description = "Estados válidos: DISPONIBLE, EN_VIAJE, DESCANSO, SUSPENDIDO, INACTIVO, ELIMINADO."
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['idChofer'] = { in: 'path', required: true, type: 'integer', description: 'ID del chofer.' }
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: { estadoChofer: 'DISPONIBLE' }
    }
    #swagger.responses[200] = { description: 'Estado actualizado.' }
    #swagger.responses[400] = { description: 'Estado no válido.' }
    #swagger.responses[404] = { description: 'Chofer no encontrado.' }
  */
  try {
    const estadoChofer = req.body.estadoChofer || req.body.estado;
    const estadosValidos = [
      'DISPONIBLE',
      'EN_VIAJE',
      'DESCANSO',
      'SUSPENDIDO',
      'INACTIVO',
      'ELIMINADO',
    ];

    if (!estadosValidos.includes(estadoChofer)) {
      return res.status(400).json({
        status: '0',
        msg: 'Estado de chofer no valido.',
      });
    }

    const chofer = await Chofer.findByPk(req.params.idChofer);

    if (!chofer) {
      return res.status(404).json({
        status: '0',
        msg: 'Chofer no encontrado.',
      });
    }

    if (req.usuario.rol !== 'ADMIN' && (['SUSPENDIDO', 'INACTIVO', 'ELIMINADO'].includes(chofer.estadoChofer) || !['DISPONIBLE', 'DESCANSO'].includes(estadoChofer))) {
      return res.status(403).json({ mensaje: 'Cambio de estado no permitido' });
    }
    if (req.usuario.rol === 'ADMIN' && ['DISPONIBLE', 'EN_VIAJE', 'DESCANSO'].includes(estadoChofer)) {
      const habilitacion = await HabilitacionChofer.findByPk(chofer.idChofer);
      if (habilitacion?.estado !== 'APROBADO') return res.status(409).json({ mensaje: 'Usa Aprobar alta para habilitar este chofer.' });
    }
    chofer.estadoChofer = estadoChofer;
    await chofer.save();

    return res.status(200).json({
      status: '1',
      msg: 'Estado del chofer actualizado.',
      chofer,
    });
  } catch (error) {
    return res.status(500).json({
      status: '0',
      msg: 'Error al actualizar el estado del chofer.',
      error: error.message,
    });
  }
};

// Actualiza la ubicacion actual del chofer.
choferCtrl.actualizarUbicacionChofer = async (req, res) => {
  /*
    #swagger.tags = ['Choferes']
    #swagger.summary = 'Actualizar ubicación del chofer'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['idChofer'] = { in: 'path', required: true, type: 'integer', description: 'ID del chofer.' }
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: { latitud: -24.1858, longitud: -65.2995, precision: 15.5 }
    }
    #swagger.responses[200] = { description: 'Ubicación actualizada.' }
    #swagger.responses[400] = { description: 'Latitud/longitud/precision no válida.' }
    #swagger.responses[404] = { description: 'Chofer no encontrado.' }
  */
  try {
    const { latitud, longitud, precision } = req.body;
    const resultado = validarUbicacion(latitud, longitud, precision);

    if (resultado.error) {
      return res.status(400).json({
        status: '0',
        msg: resultado.error,
      });
    }

    const chofer = await Chofer.findByPk(req.params.idChofer, {
      include: [
        { association: 'habilitacion' },
        {
          model: Usuario,
          as: 'usuario',
          attributes: { exclude: ['passwordHash'] },
        },
      ],
    });

    if (!chofer) {
      return res.status(404).json({
        status: '0',
        msg: 'Chofer no encontrado.',
      });
    }

    chofer.latitud = resultado.ubicacion.latitud;
    chofer.longitud = resultado.ubicacion.longitud;
    chofer.precision = resultado.ubicacion.precision;
    await chofer.save();

    const viajesActivos = await Viaje.findAll({
      where: {
        idChofer: chofer.idChofer,
        estadoViaje: { [Op.in]: ['ABIERTO', 'COMPLETO', 'EN_CURSO'] },
      },
    });

    // Emitimos por socket a los viajes activos del chofer para actualizar el mapa de los pasajeros.
    for (const viajeActivo of viajesActivos) {
      req.io?.emit(`ubicacion_chofer_viaje_${viajeActivo.idViaje}`, {
        idChofer: chofer.idChofer,
        idViaje: viajeActivo.idViaje,
        latitud: chofer.latitud,
        longitud: chofer.longitud,
        precision: chofer.precision,
      });
    }

    return res.status(200).json({
      status: '1',
      msg: 'Ubicacion del chofer actualizada.',
      chofer,
    });
  } catch (error) {
    return res.status(500).json({
      status: '0',
      msg: 'Error al actualizar la ubicacion del chofer.',
      error: error.message,
    });
  }
};


// Trae todos los autos relacionados al chofer por sus turnos.
choferCtrl.obtenerAutosDelChofer = async (req, res) => {
  /*
    #swagger.tags = ['Choferes']
    #swagger.summary = 'Autos asignados al chofer'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['idChofer'] = { in: 'path', required: true, type: 'integer', description: 'ID del chofer.' }
    #swagger.responses[200] = { description: 'Autos del chofer.', schema: [{ $ref: '#/definitions/Auto' }] }
    #swagger.responses[404] = { description: 'Chofer no encontrado.' }
  */
  try {
    const chofer = await Chofer.findByPk(req.params.idChofer, {
      include: [
        {
          model: Auto,
          as: 'autos',
        },
      ],
    });

    if (!chofer) {
      return res.status(404).json({
        status: '0',
        msg: 'Chofer no encontrado.',
      });
    }

    return res.status(200).json(chofer.autos);
  } catch (error) {
    return res.status(500).json({
      status: '0',
      msg: 'Error al obtener los autos del chofer.',
      error: error.message,
    });
  }
};

// Trae los viajes que se muestran en el boton "Ver Mis Viajes".
choferCtrl.obtenerViajesDelChofer = async (req, res) => {
  /*
    #swagger.tags = ['Choferes']
    #swagger.summary = 'Viajes del chofer'
    #swagger.description = "Usado por el botón 'Ver Mis Viajes' del frontend."
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['idChofer'] = { in: 'path', required: true, type: 'integer', description: 'ID del chofer.' }
    #swagger.responses[200] = { description: 'Viajes del chofer.', schema: [{ $ref: '#/definitions/Viaje' }] }
    #swagger.responses[404] = { description: 'Chofer no encontrado.' }
  */
  try {
    const chofer = await Chofer.findByPk(req.params.idChofer);

    if (!chofer) {
      return res.status(404).json({
        status: '0',
        msg: 'Chofer no encontrado.',
      });
    }

    const viajes = await Viaje.findAll({
      where: { idChofer: req.params.idChofer },
      include: [
        'auto',
        {
          association: 'reservas',
          include: [
            'invitado',
            {
              association: 'pasajero',
              include: [
                {
                  association: 'usuario',
                  attributes: { exclude: ['passwordHash'] },
                },
              ],
            },
          ],
        },
      ],
      order: [
        ['fechaSalida', 'DESC'],
        ['horaSalida', 'DESC'],
      ],
    });

    return res.status(200).json(viajes);
  } catch (error) {
    return res.status(500).json({
      status: '0',
      msg: 'Error al obtener los viajes del chofer.',
      error: error.message,
    });
  }
};

module.exports = choferCtrl;
