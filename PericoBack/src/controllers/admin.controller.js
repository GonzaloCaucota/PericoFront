const { fn, col } = require('sequelize');
const {
  sequelize,
  Usuario,
  Pasajero,
  Chofer,
  Auto,
  Viaje,
  Reserva,
  Admin,
} = require('../models/relaciones');

const adminCtrl = {};

// Evita devolver el passwordHash en las respuestas del servidor.
const quitarPassword = (usuario) => {
  const usuarioSinPassword = usuario.toJSON();
  delete usuarioSinPassword.passwordHash;

  return usuarioSinPassword;
};

adminCtrl.registrarAdmin = async (req, res) => {
  /*
    #swagger.tags = ['Admins']
    #swagger.summary = 'Registrar un admin'
    #swagger.description = 'Crea un Usuario con rol ADMIN y su perfil Admin asociado. Requiere rol ADMIN.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: { $ref: '#/definitions/Usuario' }
    }
    #swagger.responses[201] = { description: 'Admin registrado correctamente.' }
    #swagger.responses[400] = { description: 'No se pudo registrar el admin.' }
  */
  const {
    nombre,
    apellido,
    email,
    passwordHash,
    telefono,
    activo,
    estadoAdmin,
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
        activo,
        rol: 'ADMIN',
      },
      { transaction }
    );

    // Luego se crea el perfil Admin asociado al Usuario.
    const admin = await Admin.create(
      {
        idUsuario: usuario.idUsuario,
        estadoAdmin,
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      mensaje: 'Admin registrado correctamente',
      usuario: quitarPassword(usuario),
      admin,
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(400).json({
      mensaje: 'No se pudo registrar el admin',
      error: error.message,
    });
  }
};

adminCtrl.obtenerAdmins = async (req, res) => {
  /*
    #swagger.tags = ['Admins']
    #swagger.summary = 'Obtener todos los admins'
    #swagger.description = 'Retorna los admins junto con los datos del usuario relacionado. Requiere rol ADMIN.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = {
      description: 'Lista de admins.',
      schema: [{ $ref: '#/definitions/Admin' }]
    }
  */
  try {
    // Trae los admins junto con los datos del usuario relacionado.
    const admins = await Admin.findAll({
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: { exclude: ['passwordHash'] },
        },
      ],
    });

    return res.status(200).json(admins);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener los admins',
      error: error.message,
    });
  }
};

// GET /api/admins/dashboard
adminCtrl.getDashboard = async (req, res) => {
  /*
    #swagger.tags = ['Admins']
    #swagger.summary = 'Dashboard de métricas'
    #swagger.description = 'Totales y estadísticas del sistema (usuarios, viajes, reservas, etc). Requiere rol ADMIN.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = { description: 'Dashboard obtenido correctamente.' }
    #swagger.responses[500] = { description: 'Error al obtener los datos del dashboard.' }
  */
  try {
    const totalUsuarios = await Usuario.count();
    const totalPasajeros = await Pasajero.count();
    const totalChoferes = await Chofer.count();
    const totalAutos = await Auto.count();
    const totalViajes = await Viaje.count();
    const totalReservas = await Reserva.count();

    const viajesPorEstado = await Viaje.findAll({
      attributes: [
        'estadoViaje',
        [fn('COUNT', col('estadoViaje')), 'cantidad'],
      ],
      group: ['estadoViaje'],
      raw: true,
    });

    const reservasPorEstado = await Reserva.findAll({
      attributes: [
        'estadoReserva',
        [fn('COUNT', col('estadoReserva')), 'cantidad'],
      ],
      group: ['estadoReserva'],
      raw: true,
    });

    const fechaReserva = fn('DATE', col('Reserva.createdAt'));
    const reservasPorFecha = await Reserva.findAll({
      attributes: [
        [fechaReserva, 'fecha'],
        [fn('COUNT', col('idReserva')), 'cantidad'],
      ],
      group: [fechaReserva],
      order: [[fechaReserva, 'ASC']],
      raw: true,
    });

    const choferesPorEstado = await Chofer.findAll({
      attributes: [
        'estadoChofer',
        [fn('COUNT', col('estadoChofer')), 'cantidad'],
      ],
      group: ['estadoChofer'],
      raw: true,
    });

    const pasajerosPorEstado = await Pasajero.findAll({
      attributes: [
        'estadoPasajero',
        [fn('COUNT', col('estadoPasajero')), 'cantidad'],
      ],
      group: ['estadoPasajero'],
      raw: true,
    });

    const autosPorEstado = await Auto.findAll({
      attributes: [
        'estado',
        [fn('COUNT', col('estado')), 'cantidad'],
      ],
      group: ['estado'],
      raw: true,
    });

    const ultimasReservas = await Reserva.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [
        {
          association: 'pasajero',
          include: [
            {
              association: 'usuario',
              attributes: {
                exclude: ['passwordHash'],
              },
            },
          ],
        },
        {
          association: 'viaje',
          include: [
            {
              association: 'chofer',
              include: [
                {
                  association: 'usuario',
                  attributes: {
                    exclude: ['passwordHash'],
                  },
                },
              ],
            },
            {
              association: 'auto',
            },
          ],
        },
      ],
    });

    return res.status(200).json({
      status: '1',
      msg: 'Dashboard obtenido correctamente.',
      totales: {
        usuarios: totalUsuarios,
        pasajeros: totalPasajeros,
        choferes: totalChoferes,
        autos: totalAutos,
        viajes: totalViajes,
        reservas: totalReservas,
      },
      viajesPorEstado: viajesPorEstado.map((item) => ({
        estado: item.estadoViaje,
        cantidad: Number(item.cantidad),
      })),
      reservasPorEstado: reservasPorEstado.map((item) => ({
        estado: item.estadoReserva,
        cantidad: Number(item.cantidad),
      })),
      reservasPorFecha: reservasPorFecha.map((item) => ({
        fecha: item.fecha,
        cantidad: Number(item.cantidad),
      })),
      choferesPorEstado: choferesPorEstado.map((item) => ({
        estado: item.estadoChofer,
        cantidad: Number(item.cantidad),
      })),
      pasajerosPorEstado: pasajerosPorEstado.map((item) => ({
        estado: item.estadoPasajero,
        cantidad: Number(item.cantidad),
      })),
      autosPorEstado: autosPorEstado.map((item) => ({
        estado: item.estado,
        cantidad: Number(item.cantidad),
      })),
      ultimasReservas,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      status: '0',
      msg: 'Error al obtener los datos del dashboard.',
      error: error.message,
    });
  }
};

module.exports = adminCtrl;
