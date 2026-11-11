const { Op } = require('sequelize');
const Viaje = require('./../../src/models/viaje.model');
const Auto = require('./../../src/models/auto.model');
const Chofer = require('./../../src/models/chofer.model');
const Reserva = require('./../../src/models/reserva.model');
const Usuario = require('./../../src/models/usuario.model');
const TurnoChofer = require('./../../src/models/turnoChofer');

const { Recorrido } = require('../models/relaciones');
const viajeCtrl = {};

const protegerReservas = async (req, viajes) => {
    if (req.usuario.rol === 'ADMIN') return viajes;
    const { Pasajero } = require('../models/relaciones');
    const chofer = req.usuario.rol === 'CHOFER' && await Chofer.findOne({ where: { idUsuario: req.usuario.idUsuario } });
    const pasajero = req.usuario.rol === 'PASAJERO' && await Pasajero.findOne({ where: { idUsuario: req.usuario.idUsuario } });
    return viajes.map(viaje => {
        const datos = viaje.toJSON();
        if (!chofer || chofer.idChofer !== datos.idChofer) {
            datos.reservas = (datos.reservas || []).filter(reserva => pasajero && reserva.idPasajero === pasajero.idPasajero);
        }
        return datos;
    });
};

const validarChoferAutenticado = async (req, idChofer) => {
    // Evita que un chofer cree o modifique viajes usando el idChofer de otra cuenta.
    if (req.usuario.rol === 'ADMIN') return true;

    const chofer = await Chofer.findByPk(idChofer);
    return Boolean(chofer && chofer.idUsuario === req.usuario.idUsuario);
};

const validarAutoDelChofer = async (req, idChofer, idAuto) => {
    // El auto debe estar vinculado al chofer mediante TurnoChofer.
    if (req.usuario.rol === 'ADMIN') return true;

    const turno = await TurnoChofer.findOne({
        where: {
            idChofer,
            idAuto
        }
    });

    return Boolean(turno);
};

// Obtener TODOS los viajes con todas sus relaciones
viajeCtrl.getViajes = async (req, res) => {
    /*
      #swagger.tags = ['Viajes']
      #swagger.summary = 'Obtener todos los viajes'
      #swagger.description = 'Incluye chofer, auto y reservas.'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.responses[200] = { description: 'Lista de viajes.', schema: [{ $ref: '#/definitions/Viaje' }] }
    */
    try {
        const viajes = await Viaje.findAll({
            include: ['chofer', 'auto', { association: 'reservas', include: ['invitado'] }]
        });
        res.json(await protegerReservas(req, viajes));
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener los viajes.' });
    }
};

// Obtener un viaje específico
viajeCtrl.getViaje = async (req, res) => {
    /*
      #swagger.tags = ['Viajes']
      #swagger.summary = 'Obtener un viaje por ID'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID del viaje.' }
      #swagger.responses[200] = { description: 'Viaje encontrado.', schema: { $ref: '#/definitions/Viaje' } }
      #swagger.responses[404] = { description: 'Viaje no encontrado.' }
    */
    try {
        const viaje = await Viaje.findByPk(req.params.id, {
            include: ['chofer', 'auto', { association: 'reservas', include: ['invitado'] }]
        });
        if (!viaje) {
            return res.status(404).json({ status: '0', msg: 'Viaje no encontrado.' });
        }
        res.json((await protegerReservas(req, [viaje]))[0]);
    } catch (error) {
        return res.status(500).json({ status: '0', msg: 'Error al buscar el viaje.' });
    }
};

// La busqueda usa una FK del catalogo en vez de nombres escritos libremente.
viajeCtrl.getViajesDisponibles = async (req, res) => {
    /*
      #swagger.tags = ['Viajes']
      #swagger.summary = 'Buscar viajes disponibles por recorrido'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.parameters['idRecorrido'] = { in: 'query', required: true, type: 'integer' }
    */
    try {
        const idRecorrido = Number(req.query.idRecorrido);
        if (!Number.isSafeInteger(idRecorrido) || idRecorrido < 1) {
            return res.status(400).json({ msg: 'Selecciona un recorrido valido.' });
        }
        const recorrido = await Recorrido.findByPk(idRecorrido);
        if (!recorrido?.activo) return res.status(400).json({ msg: 'Recorrido no disponible.' });
        const viajes = await Viaje.findAll({
            where: {
                idRecorrido,
                estadoViaje: { [Op.in]: ['ABIERTO', 'EN_CURSO'] },
                asientosDisponibles: { [Op.gt]: 0 },
            },
            include: [
                { association: 'chofer', required: true, where: { estadoChofer: { [Op.in]: ['DISPONIBLE', 'EN_VIAJE', 'DESCANSO'] } }, include: [{ association: 'habilitacion', required: true, where: { estado: 'APROBADO' } }, { association: 'usuario', required: true, where: { activo: true }, attributes: { exclude: ['passwordHash'] } }] },
                'auto', { association: 'reservas', include: ['invitado'] },
            ],
            order: [['fechaSalida', 'ASC'], ['horaSalida', 'ASC']],
        });
        return res.json(await protegerReservas(req, viajes));
    } catch {
        return res.status(500).json({ msg: 'Error al buscar viajes disponibles.' });
    }
};

// Catalogo publico: proyeccion explicita, sin usuarios, reservas ni ubicaciones.
viajeCtrl.getViajesPublicos = async (req, res, next) => {
    try {
        const idRecorrido = req.query.idRecorrido === undefined ? null : Number(req.query.idRecorrido);
        if (idRecorrido !== null && (!Number.isSafeInteger(idRecorrido) || idRecorrido < 1)) return res.status(400).json({ msg: 'Selecciona un recorrido valido.' });
        const { sequelize } = require('../models/relaciones');
        const viajes = await Viaje.findAll({
            where: {
                ...(idRecorrido === null ? {} : { idRecorrido }),
                estadoViaje: { [Op.in]: ['ABIERTO', 'EN_CURSO'] },
                asientosDisponibles: { [Op.gt]: 0 },
                fechaSalida: { [Op.gte]: sequelize.literal("(CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Jujuy')::date") },
            },
            include: [
                { association: 'recorrido', required: true, where: { activo: true }, include: [{ association: 'paradaOrigen', include: ['ciudad'] }, { association: 'paradaDestino', include: ['ciudad'] }] },
                { association: 'chofer', attributes: ['idChofer'], required: true, where: { estadoChofer: { [Op.in]: ['DISPONIBLE', 'EN_VIAJE', 'DESCANSO'] } }, include: [
                    { association: 'habilitacion', attributes: [], required: true, where: { estado: 'APROBADO' } },
                    { association: 'usuario', attributes: [], required: true, where: { activo: true } },
                ] },
                { association: 'auto', attributes: ['marca', 'modelo', 'capacidadAsientos'], required: true, where: { estado: { [Op.in]: ['DISPONIBLE', 'EN_VIAJE'] } } },
            ],
            limit: 100, order: [['fechaSalida', 'ASC'], ['horaSalida', 'ASC'], ['idViaje', 'ASC']],
        });
        return res.json(viajes.map(v => ({
            idViaje: v.idViaje, idRecorrido: v.idRecorrido, origen: v.origen, destino: v.destino,
            fechaSalida: v.fechaSalida, horaSalida: v.horaSalida, tarifaPorAsiento: v.tarifaPorAsiento,
            asientosDisponibles: v.asientosDisponibles, estadoViaje: v.estadoViaje,
            salida: v.recorrido.paradaOrigen.nombre, llegada: v.recorrido.paradaDestino.nombre,
            llegadaConfirmada: v.recorrido.paradaDestino.ubicacionConfirmada,
            vehiculo: { marca: v.auto.marca, modelo: v.auto.modelo, capacidadAsientos: v.auto.capacidadAsientos },
        })));
    } catch (error) { next(error); }
};

// Registrar un nuevo viaje
viajeCtrl.createViaje = async (req, res) => {
    /*
      #swagger.tags = ['Viajes']
      #swagger.summary = 'Registrar un viaje'
      #swagger.description = 'Asigna chofer y auto. Requiere rol ADMIN. Los asientos disponibles se toman de la capacidad del auto.'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/Viaje' } }
      #swagger.responses[200] = { description: 'Viaje guardado de forma exitosa.' }
      #swagger.responses[400] = { description: 'Chofer o Auto no válidos, o auto ya EN_CURSO.' }
    */
    try {
        const { idChofer, idAuto } = req.body;
        const idRecorrido = Number(req.body.idRecorrido);
        if (!Number.isSafeInteger(idRecorrido) || idRecorrido < 1) return res.status(400).json({ msg: 'Selecciona un recorrido valido.' });
        const recorrido = await Recorrido.findByPk(idRecorrido);
        if (!recorrido?.activo) return res.status(400).json({ msg: 'Recorrido no disponible.' });

        // Verificar que existan el chofer y el auto
        const choferExiste = await Chofer.findByPk(idChofer);
        const autoExiste = await Auto.findByPk(idAuto);

        if (!choferExiste || !autoExiste) {
            return res.status(400).json({ status: '0', msg: 'Chofer o Auto no válidos/inexistentes.' });
        }

        if (!(await require('../services/cuenta-habilitada').choferAprobado(idChofer))) return res.status(403).json({ msg: 'El chofer debe estar aprobado y habilitado por administracion.' });
        if (autoExiste.estado !== 'DISPONIBLE') return res.status(400).json({ msg: 'El vehiculo no esta habilitado o disponible.' });

        // Un auto no puede estar en más de un viaje EN_CURSO al mismo tiempo
        if (!(await validarChoferAutenticado(req, idChofer))) {
            return res.status(403).json({ status: '0', msg: 'No tenes permiso para crear viajes para este chofer.' });
        }

        if (!(await validarAutoDelChofer(req, idChofer, idAuto))) {
            return res.status(403).json({ status: '0', msg: 'No tenes permiso para usar este auto.' });
        }

        const autoOcupado = await Viaje.findOne({
            where: {
                idAuto: idAuto,
                estadoViaje: 'EN_CURSO'
            }
        });

        if (autoOcupado) {
            return res.status(400).json({ status: '0', msg: 'El auto asignado ya se encuentra en un viaje EN CURSO.' });
        }

        // La capacidad del auto define los asientos iniciales del viaje.
        const asientosIniciales = autoExiste.capacidadAsientos;

        const nuevoViaje = await Viaje.create({
            idRecorrido, idChofer, idAuto,
            fechaSalida: req.body.fechaSalida, horaSalida: req.body.horaSalida,
            tarifaPorAsiento: req.body.tarifaPorAsiento,
            asientosDisponibles: asientosIniciales,
            estadoViaje: 'ABIERTO'
        });

        const viajeCreado = await Viaje.findByPk(nuevoViaje.idViaje);
        req.io?.emit('viaje_creado', {
            idViaje: nuevoViaje.idViaje,
            idRecorrido: nuevoViaje.idRecorrido,
            viaje: viajeCreado
        });
        if (choferExiste.latitud !== null && choferExiste.latitud !== undefined && choferExiste.longitud !== null && choferExiste.longitud !== undefined) {
            req.io?.emit(`ubicacion_chofer_viaje_${nuevoViaje.idViaje}`, {
                idViaje: nuevoViaje.idViaje,
                idChofer: choferExiste.idChofer,
                latitud: choferExiste.latitud,
                longitud: choferExiste.longitud,
                precision: choferExiste.precision
            });
        }

        res.status(201).json({ status: '1', msg: 'Viaje guardado de forma exitosa.', viaje: viajeCreado });
    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando la operación de guardado.' });
    }
};


// Editar datos del viaje
viajeCtrl.editViaje = async (req, res) => {
    /*
      #swagger.tags = ['Viajes']
      #swagger.summary = 'Editar un viaje'
      #swagger.description = 'Requiere rol ADMIN.'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID del viaje.' }
      #swagger.parameters['body'] = { in: 'body', required: true, schema: { $ref: '#/definitions/Viaje' } }
      #swagger.responses[200] = { description: 'Viaje actualizado con éxito.' }
      #swagger.responses[404] = { description: 'Viaje no encontrado.' }
    */
    try {
        if (req.body.origen !== undefined || req.body.destino !== undefined) return res.status(400).json({ msg: 'Usa idRecorrido para seleccionar el trayecto.' });
        if (req.body.idRecorrido !== undefined) {
            const recorrido = await Recorrido.findByPk(req.body.idRecorrido);
            if (!recorrido?.activo) return res.status(400).json({ msg: 'Recorrido no disponible.' });
        }
        const campos = ['idRecorrido', 'fechaSalida', 'horaSalida', 'tarifaPorAsiento'];
        const cambios = Object.fromEntries(campos.filter(campo => req.body[campo] !== undefined).map(campo => [campo, req.body[campo]]));
        const [actualizados] = await Viaje.update(cambios, {
            where: { idViaje: req.params.id }
        });
        if (actualizados === 0) {
            return res.status(404).json({ status: '0', msg: 'Viaje no encontrado.' });
        }
        res.json({ status: '1', msg: 'Viaje actualizado con éxito.' });
    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando la operación.' });
    }
};


// Cambiar estado del viaje
viajeCtrl.changeEstado = async (req, res) => {
    /*
      #swagger.tags = ['Viajes']
      #swagger.summary = 'Cambiar estado del viaje'
      #swagger.description = "Estados válidos: ABIERTO, COMPLETO, EN_CURSO, FINALIZADO, CANCELADO. Solo ADMIN o el chofer asignado."
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID del viaje.' }
      #swagger.parameters['body'] = { in: 'body', required: true, schema: { estado: 'EN_CURSO' } }
      #swagger.responses[200] = { description: 'Estado del viaje actualizado.' }
      #swagger.responses[400] = { description: 'Estado de viaje no válido.' }
      #swagger.responses[403] = { description: 'No tenes permiso para modificar este viaje.' }
      #swagger.responses[404] = { description: 'Viaje no encontrado.' }
    */
    try {
        const idViaje = req.params.id;
        const estado = req.body.estado;

        const estadosValidos = ['ABIERTO', 'COMPLETO', 'EN_CURSO', 'FINALIZADO', 'CANCELADO'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ status: '0', msg: 'Estado de viaje no válido.' });
        }

        const viaje = await Viaje.findByPk(idViaje);
        if (!viaje) {
            return res.status(404).json({ status: '0', msg: 'Viaje no encontrado.' });
        }

        // Solo puede cambiar el estado: un ADMIN, o el chofer asignado a ese viaje.
        if (req.usuario.rol !== 'ADMIN') {
            const chofer = await Chofer.findByPk(viaje.idChofer);
            if (!chofer || chofer.idUsuario !== req.usuario.idUsuario) {
                return res.status(403).json({ status: '0', msg: 'No tenes permiso para modificar este viaje.' });
            }
        }

        if (['FINALIZADO', 'CANCELADO'].includes(viaje.estadoViaje)) return res.status(400).json({ mensaje: 'El viaje ya termino' });

        // Al cambiar estado se notifica a pasajero/chofer por Socket.IO para refrescar las pantallas.
        viaje.estadoViaje = estado;
        await viaje.save();

        const reservasActualizadas = [];

        if (estado === 'EN_CURSO' || estado === 'CANCELADO' || estado === 'FINALIZADO') {
            const reservasActivas = await Reserva.findAll({
                where: {
                    idViaje: viaje.idViaje,
                    estadoReserva: {
                        [Op.in]: ['PENDIENTE', 'CONFIRMADA']
                    }
                }
            });

            for (const reserva of reservasActivas) {
                if (estado === 'EN_CURSO') {
                    if (reserva.estadoReserva === 'PENDIENTE') {
                        reserva.estadoReserva = 'CONFIRMADA';
                        await reserva.save();
                    }
                } else {
                    reserva.estadoReserva = estado === 'CANCELADO' ? 'CANCELADA' : 'UTILIZADA';
                    await reserva.save();
                }
                reservasActualizadas.push(reserva);

                if (req.io) {
                    req.io.emit(`reserva_actualizada_${reserva.idReserva}`, {
                        idReserva: reserva.idReserva,
                        idViaje: viaje.idViaje,
                        estadoReserva: reserva.estadoReserva,
                        estadoViaje: viaje.estadoViaje,
                        reserva,
                        viaje
                    });

                    if (estado === 'CANCELADO') {
                        req.io.emit(`reserva_cancelada_${reserva.idReserva}`, {
                            idReserva: reserva.idReserva,
                            idViaje: viaje.idViaje,
                            reserva,
                            viaje
                        });
                    }
                }
            }
        }

        const viajeActualizado = await Viaje.findByPk(idViaje, {
            include: ['chofer', 'auto', { association: 'reservas', include: ['invitado'] }]
        });

        if (req.io) {
            req.io.emit(`viaje_actualizado_${viaje.idViaje}`, {
                idViaje: viaje.idViaje,
                estadoViaje: viaje.estadoViaje,
                viaje: viajeActualizado
            });
        }

        return res.status(200).json({
            status: '1',
            msg: 'Estado del viaje actualizado.',
            viaje: viajeActualizado,
            reservasActualizadas
        });
    } catch (error) {
        return res.status(500).json({ status: '0', msg: 'Error al actualizar el estado.', error: error.message });
    }
};

// Actualizar asientos disponibles del viaje
viajeCtrl.actualizarAsientosDisponibles = async (req, res) => {
    /*
      #swagger.tags = ['Viajes']
      #swagger.summary = 'Actualizar asientos disponibles'
      #swagger.description = 'Se dispara al reservar. No puede superar la capacidad del auto.'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID del viaje.' }
      #swagger.parameters['body'] = { in: 'body', required: true, schema: { asientosDisponibles: 3 } }
      #swagger.responses[200] = { description: 'Asientos disponibles actualizados.' }
      #swagger.responses[400] = { description: 'Valor inválido o supera la capacidad del auto.' }
      #swagger.responses[404] = { description: 'Viaje no encontrado.' }
    */
    try {
        const idViaje = req.params.id;
        const { asientosDisponibles } = req.body;

        if (asientosDisponibles === undefined || asientosDisponibles === null) {
            return res.status(400).json({ status: '0', msg: 'Debe enviar asientosDisponibles.' });
        }

        const nuevosAsientos = Number(asientosDisponibles);
        if (!Number.isInteger(nuevosAsientos) || nuevosAsientos < 0) {
            return res.status(400).json({ status: '0', msg: 'Los asientos disponibles deben ser un numero entero mayor o igual a 0.' });
        }

        const viaje = await Viaje.findByPk(idViaje, {
            include: ['auto']
        });

        if (!viaje) {
            return res.status(404).json({ status: '0', msg: 'Viaje no encontrado.' });
        }

        if (viaje.auto && nuevosAsientos > viaje.auto.capacidadAsientos) {
            return res.status(400).json({ status: '0', msg: 'Los asientos disponibles no pueden superar la capacidad del auto.' });
        }

        if (req.usuario.rol !== 'ADMIN') {
            const chofer = await Chofer.findByPk(viaje.idChofer);
            if (!chofer || chofer.idUsuario !== req.usuario.idUsuario) {
                return res.status(403).json({ status: '0', msg: 'No tenes permiso para actualizar los asientos de este viaje.' });
            }
        }

        viaje.asientosDisponibles = nuevosAsientos;
        await viaje.save();

        const viajeActualizado = await Viaje.findByPk(idViaje, {
            include: ['chofer', 'auto', { association: 'reservas', include: ['invitado'] }]
        });

        if (req.io) {
            req.io.emit(`asientos_actualizados_viaje_${viajeActualizado.idViaje}`, {
                idViaje: viajeActualizado.idViaje,
                asientosDisponibles: viajeActualizado.asientosDisponibles,
                viaje: viajeActualizado
            });
        }

        return res.status(200).json({
            status: '1',
            msg: 'Asientos disponibles actualizados.',
            viaje: viajeActualizado
        });
    } catch (error) {
        return res.status(500).json({ status: '0', msg: 'Error al actualizar los asientos disponibles.' });
    }
};


// Eliminar un viaje
viajeCtrl.deleteViaje = async (req, res) => {
    /*
      #swagger.tags = ['Viajes']
      #swagger.summary = 'Eliminar un viaje'
      #swagger.description = 'Requiere rol ADMIN.'
      #swagger.security = [{ "bearerAuth": [] }]
      #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID del viaje.' }
      #swagger.responses[200] = { description: 'Viaje eliminado.' }
    */
    try {
        await Viaje.destroy({
            where: { idViaje: req.params.id }
        });
        res.json({ status: '1', msg: 'Viaje eliminado.' });
    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando la operación.' });
    }
};

module.exports = viajeCtrl;
