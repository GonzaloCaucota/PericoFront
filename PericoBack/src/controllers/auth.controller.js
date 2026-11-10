const jwt = require('jsonwebtoken'); 
const authCtrl = {} 
 
authCtrl.verifyToken = async (req, res, next) => { 
    // JWT protege las rutas privadas: el front envia Authorization: Bearer <token>.
    // Si el token es valido, el payload queda disponible como req.usuario para los demas controladores.
    // 1. Validar si el header existe antes de hacer split 
    const authHeader = req.headers.authorization; 
    if (!authHeader) { 
        return res.status(401).json({ message: 'Unauthorized request: No token provided.' }); 
    } 
 
    // 2. Extraer el token separando por el espacio 
    const token = /^Bearer ([^\s]+)$/i.exec(authHeader)?.[1]; 
     
    // 3. Validar que el token no sea undefined o esté vacío 
    if (!token || token === 'null') { 
        return res.status(401).json({ message: 'Unauthorized request: Invalid token format.' }); 
    } 
 
    try { 
        // 4. Capturar errores de verificación (token expirado, firma inválida, etc.) 
        const decoded = jwt.verify(token, process.env.JWT_SECRET); 

        const { Usuario } = require('../models/relaciones');
        const cuenta = await Usuario.findByPk(decoded.idUsuario);
        if (!cuenta || !cuenta.activo || cuenta.rol !== decoded.rol) {
            return res.status(401).json({ message: 'Cuenta no habilitada.' });
        }
        req.usuario = decoded;

        next(); 
    } catch (error) { 
        return res.status(401).json({ message: 'Unauthorized request: Invalid or expired token.' }); 
    } 
} 


// Middleware de autorizacion por rol.
// Se usa DESPUES de verifyToken, porque necesita req.usuario ya cargado.
// Uso: authCtrl.verificarRol('ADMIN') o authCtrl.verificarRol('ADMIN', 'CHOFER')
authCtrl.verificarRol = (...rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ message: 'Unauthorized request: No autenticado.' });
        }

        if (!rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({ message: 'No tenes permiso para acceder a este recurso.' });
        }

        next();
    };
};

// Resuelve el perfil desde la base, sin confiar en IDs enviados por el cliente.
authCtrl.propietarioPerfil = (modelo, parametro) => async (req, res, next) => {
    try {
        if (req.usuario.rol === 'ADMIN') return next();
        const perfil = await modelo.findByPk(req.params[parametro]);
        if (!perfil) return res.status(404).json({ mensaje: 'Perfil no encontrado' });
        if (perfil.idUsuario !== req.usuario.idUsuario) {
            return res.status(403).json({ mensaje: 'No tenes permiso sobre este perfil' });
        }
        next();
    } catch (error) { next(error); }
};

authCtrl.choferReserva = async (req, res, next) => {
    try {
        if (req.usuario.rol === 'ADMIN') return next();
        const { Reserva, Viaje, Chofer } = require('../models/relaciones');
        const reserva = await Reserva.findByPk(req.params.idReserva);
        if (!reserva) return res.status(404).json({ mensaje: 'Reserva no encontrada' });
        const viaje = await Viaje.findByPk(reserva.idViaje);
        const chofer = viaje && await Chofer.findByPk(viaje.idChofer);
        if (!chofer || chofer.idUsuario !== req.usuario.idUsuario) {
            return res.status(403).json({ mensaje: 'No tenes permiso sobre esta reserva' });
        }
        next();
    } catch (error) { next(error); }
};

module.exports = authCtrl; 
