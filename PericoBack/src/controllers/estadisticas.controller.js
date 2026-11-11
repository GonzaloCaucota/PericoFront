const { sequelize, Chofer, TurnoChofer } = require('../models/relaciones');

exports.obtener = (tipo) => async (req, res, next) => {
  try {
    const esChofer = tipo === 'choferes';
    const clave = esChofer ? 'idChofer' : 'idAuto';
    const id = Number(esChofer ? req.params.idChofer : req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ mensaje: 'ID no valido' });
    if (!esChofer && req.usuario.rol !== 'ADMIN') {
      const chofer = await Chofer.findOne({ where: { idUsuario: req.usuario.idUsuario } });
      const turno = chofer && await TurnoChofer.findOne({ where: { idChofer: chofer.idChofer, idAuto: id } });
      if (!turno) return res.status(403).json({ mensaje: 'No tenes permiso sobre este auto' });
    }
    // Los identificadores SQL son constantes internas; el ID llega parametrizado.
    const [rows] = await sequelize.query(`SELECT * FROM taxi.estadisticas_${tipo} WHERE "${clave}" = :id`, { replacements: { id } });
    if (!rows.length) return res.status(404).json({ mensaje: 'Registro no encontrado' });
    return res.json(rows[0]);
  } catch (error) { next(error); }
};
