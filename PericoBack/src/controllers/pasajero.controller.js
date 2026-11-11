const { sequelize, Usuario, Pasajero, Reserva, Viaje, Chofer, Auto } = require('../models/relaciones');

const pasajeroCtrl = {};

pasajeroCtrl.actualizarPasajero = async (req, res) => {
  /*
    #swagger.tags = ['Pasajeros']
    #swagger.summary = 'Actualizar pasajero'
    #swagger.description = 'Actualiza los datos de Usuario y del perfil Pasajero. Solo se modifican los campos enviados.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['idPasajero'] = { in: 'path', required: true, type: 'integer', description: 'ID del pasajero.' }
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: { $ref: '#/definitions/Pasajero' }
    }
    #swagger.responses[200] = { description: 'Pasajero actualizado correctamente.' }
    #swagger.responses[404] = { description: 'Pasajero no encontrado.' }
  */
  if (req.usuario.rol !== 'ADMIN' && ['activo', 'estadoPasajero', 'calificacion', 'cantidadReservas', 'estadoChofer'].some(campo => req.body[campo] !== undefined)) {
    return res.status(403).json({ mensaje: 'Solo administracion puede modificar estos campos' });
  }
  if (req.body.activo !== undefined || req.body.estadoPasajero !== undefined) return res.status(400).json({ mensaje: 'Usa las acciones administrativas de aprobar, habilitar o bloquear para cambiar el acceso.' });
  const {
    nombre,
    apellido,
    email,
    telefono,
    activo,
    password,
    calificacion,
    estadoPasajero,
  } = req.body;

  const transaction = await sequelize.transaction();

  try {
    const pasajero = await Pasajero.findByPk(req.params.idPasajero, {
      include: [{ model: Usuario, as: 'usuario' }],
      transaction,
    });

    if (!pasajero) {
      await transaction.rollback();
      return res.status(404).json({
        mensaje: 'Pasajero no encontrado',
      });
    }

    const usuario = pasajero.usuario;

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

    if (calificacion !== undefined) pasajero.calificacion = calificacion;
    if (estadoPasajero !== undefined) pasajero.estadoPasajero = estadoPasajero;

    await pasajero.save({ transaction });

    await transaction.commit();
    if (req.usuario?.rol === 'ADMIN') req.io?.desconectarUsuario?.(usuario.idUsuario);

    return res.status(200).json({
      mensaje: 'Pasajero actualizado correctamente',
      usuario: quitarPassword(usuario),
      pasajero,
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(400).json({
      mensaje: 'No se pudo actualizar el pasajero',
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

pasajeroCtrl.registrarPasajero = async (req, res) => {
  /*
    #swagger.tags = ['Pasajeros']
    #swagger.summary = 'Registrar un pasajero'
    #swagger.description = 'Crea un Usuario con rol PASAJERO y su perfil Pasajero asociado. Ruta pública (registro).'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: { $ref: '#/definitions/Usuario' }
    }
    #swagger.responses[201] = { description: 'Pasajero registrado correctamente.' }
    #swagger.responses[400] = { description: 'No se pudo registrar el pasajero.' }
  */
  const {
    nombre,
    apellido,
    email,
    passwordHash,
    telefono,
    activo,
    calificacion,
    estadoPasajero,
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
        activo: true,
        rol: 'PASAJERO',
      },
      { transaction }
    );

    // Luego se crea el perfil Pasajero asociado al Usuario.
    const pasajero = await Pasajero.create(
      {
        idUsuario: usuario.idUsuario,
        calificacion: 0,
        estadoPasajero: 'ACTIVO',
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      mensaje: 'Pasajero registrado correctamente',
      usuario: quitarPassword(usuario),
      pasajero,
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(400).json({
      mensaje: 'No se pudo registrar el pasajero',
      error: error.message,
    });
  }
};

pasajeroCtrl.obtenerPasajeros = async (req, res) => {
  /*
    #swagger.tags = ['Pasajeros']
    #swagger.summary = 'Obtener todos los pasajeros'
    #swagger.description = 'Retorna los pasajeros junto con los datos del usuario relacionado. Requiere rol ADMIN.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = {
      description: 'Lista de pasajeros.',
      schema: [{ $ref: '#/definitions/Pasajero' }]
    }
  */
  try {
    // Trae los pasajeros junto con los datos del usuario relacionado.
    const pasajeros = await Pasajero.findAll({
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: { exclude: ['passwordHash'] },
        },
      ],
    });

    return res.status(200).json(pasajeros);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener los pasajeros',
      error: error.message,
    });
  }
};

pasajeroCtrl.obtenerPasajero = async (req, res) => {
  /*
    #swagger.tags = ['Pasajeros']
    #swagger.summary = 'Obtener un pasajero por ID'
    #swagger.description = 'Trae el perfil del pasajero, su usuario y sus reservas con el viaje asociado.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['idPasajero'] = { in: 'path', required: true, type: 'integer', description: 'ID del pasajero.' }
    #swagger.responses[200] = { description: 'Pasajero encontrado.', schema: { $ref: '#/definitions/Pasajero' } }
    #swagger.responses[404] = { description: 'Pasajero no encontrado.' }
  */
  try {
    // Trae el perfil completo del pasajero, sus datos de usuario y sus reservas.
    const pasajero = await Pasajero.findByPk(req.params.idPasajero, {
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: { exclude: ['passwordHash'] },
        },
        {
          model: Reserva,
          as: 'reservas',
          include: [
            {
              model: Viaje,
              as: 'viaje',
              include: [
                {
                  model: Chofer,
                  as: 'chofer',
                  include: [
                    {
                      model: Usuario,
                      as: 'usuario',
                      attributes: { exclude: ['passwordHash'] },
                    },
                  ],
                },
                {
                  model: Auto,
                  as: 'auto',
                },
              ],
            },
          ],
        },
      ],
    });

    if (!pasajero) {
      return res.status(404).json({
        mensaje: 'Pasajero no encontrado',
      });
    }

    return res.status(200).json(pasajero);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener el pasajero',
      error: error.message,
    });
  }
};

pasajeroCtrl.actualizarUbicacionPasajero = async (req, res) => {
  /*
    #swagger.tags = ['Pasajeros']
    #swagger.summary = 'Actualizar ubicación del pasajero'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['idPasajero'] = { in: 'path', required: true, type: 'integer', description: 'ID del pasajero.' }
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: { latitud: -24.1858, longitud: -65.2995, precision: 15.5 }
    }
    #swagger.responses[200] = { description: 'Ubicación actualizada.' }
    #swagger.responses[400] = { description: 'Latitud/longitud/precision no válida.' }
    #swagger.responses[404] = { description: 'Pasajero no encontrado.' }
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

    const pasajero = await Pasajero.findByPk(req.params.idPasajero, {
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: { exclude: ['passwordHash'] },
        },
      ],
    });

    if (!pasajero) {
      return res.status(404).json({
        status: '0',
        msg: 'Pasajero no encontrado.',
      });
    }

    pasajero.latitud = resultado.ubicacion.latitud;
    pasajero.longitud = resultado.ubicacion.longitud;
    pasajero.precision = resultado.ubicacion.precision;
    await pasajero.save();

    return res.status(200).json({
      status: '1',
      msg: 'Ubicacion del pasajero actualizada.',
      pasajero,
    });
  } catch (error) {
    return res.status(500).json({
      status: '0',
      msg: 'Error al actualizar la ubicacion del pasajero.',
      error: error.message,
    });
  }
};

pasajeroCtrl.obtenerHistorialPasajero = async (req, res) => {
  /*
    #swagger.tags = ['Pasajeros']
    #swagger.summary = 'Historial de reservas del pasajero'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['idPasajero'] = { in: 'path', required: true, type: 'integer', description: 'ID del pasajero.' }
    #swagger.responses[200] = {
      description: 'Historial de reservas con su viaje asociado.',
      schema: [{ $ref: '#/definitions/Reserva' }]
    }
    #swagger.responses[404] = { description: 'Pasajero no encontrado.' }
  */
  try {
    // El historial se arma desde las reservas del pasajero e incluye el viaje asociado.
    const pasajero = await Pasajero.findByPk(req.params.idPasajero);
    if (!pasajero) {
      return res.status(404).json({
        mensaje: 'Pasajero no encontrado',
      });
    }

    const historial = await Reserva.findAll({
      where: { idPasajero: req.params.idPasajero },
      include: [
        {
          model: Viaje,
          as: 'viaje',
          include: ['chofer', 'auto'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json(historial);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener el historial del pasajero',
      error: error.message,
    });
  }
};

module.exports = pasajeroCtrl;
