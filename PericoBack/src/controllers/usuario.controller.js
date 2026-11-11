const { sequelize, Usuario, Chofer, Pasajero, Admin } = require('../models/relaciones');

const jwt = require('jsonwebtoken');

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const usuarioCtrl = {};

// Obtener todos los usuarios
usuarioCtrl.obtenerUsuarios = async (req, res) => {
  /*
    #swagger.tags = ['Usuarios']
    #swagger.summary = 'Obtener todos los usuarios'
    #swagger.description = 'Retorna la lista completa de usuarios. Requiere rol ADMIN.'
    #swagger.security = [{ "bearerAuth": [] }]
    #swagger.responses[200] = {
      description: 'Lista de usuarios obtenida con éxito.',
      schema: [{ $ref: '#/definitions/Usuario' }]
    }
    #swagger.responses[401] = { description: 'No autenticado.' }
    #swagger.responses[403] = { description: 'No tiene rol ADMIN.' }
  */
  try {
    const usuarios = await Usuario.findAll({
      attributes: {
      }
    });

    return res.status(200).json(usuarios);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener los usuarios',
      error: error.message
    });
  }
};


//logueo con google
usuarioCtrl.loginGoogle = async (req, res) => {
  /*
    #swagger.tags = ['Usuarios']
    #swagger.summary = 'Login con Google'
    #swagger.description = 'Valida un idToken de Google y crea el usuario si no existe.'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: { token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6...' }
    }
    #swagger.responses[200] = { description: 'Login exitoso, retorna el token JWT propio.' }
    #swagger.responses[401] = { description: 'Token de Google inválido.' }
  */
  const { token } = req.body;
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ status: 0, msg: 'El acceso con Google todavia no esta configurado.' });
  if (typeof token !== 'string' || !token.trim() || token.length > 10000) return res.status(400).json({ status: 0, msg: 'Falta una credencial valida de Google.' });

  try {

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email_verified || !payload.email) throw new Error('Email de Google no verificado');
    const email = payload.email.trim().toLowerCase();
    const nombre = payload.given_name || '';
    const apellido = payload.family_name || '';

    let usuario = await Usuario.findOne({
      where: { email }
    });

    // Si no existe lo crea automáticamente
    if (!usuario) {

      usuario = await sequelize.transaction(async (transaction) => {
        const nuevo = await Usuario.create({
          nombre, apellido, email, telefono: '', passwordHash: '', activo: true, rol: 'PASAJERO'
        }, { transaction });
        await Pasajero.create({ idUsuario: nuevo.idUsuario }, { transaction });
        return nuevo;
      });

    }

    const perfiles = { PASAJERO: Pasajero, CHOFER: Chofer, ADMIN: Admin };
    const perfil = await perfiles[usuario.rol]?.findOne({ where: { idUsuario: usuario.idUsuario } });
    const habilitado = perfil && (usuario.rol === 'PASAJERO' ? perfil.estadoPasajero === 'ACTIVO'
      : usuario.rol === 'ADMIN' ? perfil.estadoAdmin === 'ACTIVO'
      : ['DISPONIBLE', 'EN_VIAJE', 'DESCANSO'].includes(perfil.estadoChofer));
    if (!usuario.activo || !habilitado || !(await require('../services/cuenta-habilitada')({ idUsuario: usuario.idUsuario, rol: usuario.rol }))) return res.status(403).json({ status: 0, msg: 'Cuenta no habilitada' });
    const jwtToken = jwt.sign({ idUsuario: usuario.idUsuario, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return res.json({
      status: 1, msg: 'Login Google exitoso', token: jwtToken,
      idUsuario: usuario.idUsuario, rol: usuario.rol, nombre: usuario.nombre,
      apellido: usuario.apellido, email: usuario.email, telefono: usuario.telefono,
      idPasajero: perfil.idPasajero, idChofer: perfil.idChofer, idAdmin: perfil.idAdmin,
      usuario
    });

  } catch (error) {

    return res.status(401).json({
      status: 0,
      msg: 'No se pudo validar tu identidad con Google. Intenta iniciar sesion nuevamente.'
    });

  }
};

// Login único para todos los usuarios
usuarioCtrl.login = async (req, res) => {
  /*
    #swagger.tags = ['Usuarios']
    #swagger.summary = 'Login (Pasajero, Chofer o Admin)'
    #swagger.description = 'Valida email y password, y retorna un token JWT según el rol del usuario.'
    #swagger.parameters['body'] = {
      in: 'body',
      required: true,
      schema: { $ref: '#/definitions/LoginRequest' }
    }
    #swagger.responses[200] = { description: 'Login exitoso o credenciales incorrectas (status: 0/1).' }
    #swagger.responses[400] = { description: 'Faltan credenciales.' }
  */
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: 0,
      msg: 'Faltan credenciales',
    });
  }

  try {
    const usuario = await Usuario.findOne({
      where: {
        email,
      },
      include: [
        {
          model: Chofer,
          as: 'perfilChofer',
          required: false,
        },
        {
          model: Pasajero,
          as: 'perfilPasajero',
          required: false,
        },
        {
          model: Admin,
          as: 'perfilAdmin',
          required: false,
        },
      ],
    });

    if (!usuario) {
      return res.json({
        status: 0,
        msg: 'Credenciales incorrectas',
      });
    }

    // Compara la contraseña ingresada contra el hash guardado en la base.
    const passwordValida = await usuario.compararPassword(password);
    if (!passwordValida) {
      return res.json({
        status: 0,
        msg: 'Credenciales incorrectas',
      });
    }


    if (usuario.rol === 'CHOFER' && !(await require('../services/cuenta-habilitada')({ idUsuario: usuario.idUsuario, rol: usuario.rol }))) {
      return res.status(403).json({ status: 0, msg: 'Tu cuenta de chofer esta pendiente de aprobacion o fue suspendida por administracion.' });
    }

    if (!usuario.activo) {
      return res.json({
        status: 0,
        msg: 'La cuenta de usuario no esta activa',
      });
    }

    // ==========================
    // LOGIN ADMIN
    // ==========================
    if (usuario.rol === 'ADMIN') {
      if (!usuario.perfilAdmin) {
        return res.json({
          status: 0,
          msg: 'No se encontro el perfil de admin asociado',
        });
      }

      if (usuario.perfilAdmin.estadoAdmin !== 'ACTIVO') {
        return res.json({
          status: 0,
          msg: 'La cuenta de admin no esta activa',
        });
      }

      //token de 1 hora de expiracion para admin
      const token = jwt.sign({idUsuario: usuario.idUsuario,rol: usuario.rol},process.env.JWT_SECRET,{expiresIn: '1h'});

      return res.json({
        status: 1,
        msg: 'success',
        rol: 'ADMIN',
        idUsuario: usuario.idUsuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        telefono: usuario.telefono,
        token: token
      });
    }

    // ==========================
    // LOGIN CHOFER
    // ==========================
    if (usuario.rol === 'CHOFER') {
      const ESTADOS_CHOFER_HABILITADOS = [
        'DISPONIBLE',
        'EN_VIAJE',
        'DESCANSO',
      ];

      if (!usuario.perfilChofer) {
        return res.json({
          status: 0,
          msg: 'No se encontró el perfil de chofer asociado',
        });
      }

      if (
        !ESTADOS_CHOFER_HABILITADOS.includes(
          usuario.perfilChofer.estadoChofer
        )
      ) {
        return res.json({
          status: 0,
          msg: 'La cuenta de chofer no está habilitada para ingresar',
        });
      }

      //token de 1 hora de expiracion para chofer
      const token = jwt.sign(
        {
          idUsuario: usuario.idUsuario,
          rol: usuario.rol
        },
        process.env.JWT_SECRET,
        {
          expiresIn: '1h'
        }
      );

      return res.json({
        status: 1,
        msg: 'success',
        rol: 'CHOFER',
        idUsuario: usuario.idUsuario,
        idChofer: usuario.perfilChofer.idChofer,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        telefono: usuario.telefono,
        estadoChofer: usuario.perfilChofer.estadoChofer,
        token: token
      });
    }

    // ==========================
    // LOGIN PASAJERO
    // ==========================
    if (usuario.rol === 'PASAJERO') {
      if (!usuario.perfilPasajero) {
        return res.json({
          status: 0,
          msg: 'No se encontró el perfil de pasajero asociado',
        });
      }

      if (usuario.perfilPasajero.estadoPasajero !== 'ACTIVO') {
        return res.json({
          status: 0,
          msg: 'La cuenta de pasajero no está activa',
        });
      }

      //token de 1 hora de expiracion para pasajero
      const token = jwt.sign(
        {
          idUsuario: usuario.idUsuario,
          rol: usuario.rol
        },
        process.env.JWT_SECRET,
        {
          expiresIn: '1h'
        }
      );

      return res.json({
        status: 1,
        msg: 'success',
        rol: 'PASAJERO',
        idUsuario: usuario.idUsuario,
        idPasajero: usuario.perfilPasajero.idPasajero,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        telefono: usuario.telefono,
        estadoPasajero: usuario.perfilPasajero.estadoPasajero,
        token: token
      });
    }

    return res.json({
      status: 0,
      msg: 'Rol no válido',
    });

  } catch (error) {
    return res.status(500).json({
      status: 0,
      msg: 'error',
      error: error.message,
    });
  }
};

module.exports = usuarioCtrl;
