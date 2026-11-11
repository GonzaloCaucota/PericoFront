const { Recorrido } = require('../models/relaciones');

exports.listar = async (req, res) => {
  /*
    #swagger.tags = ['Recorridos']
    #swagger.summary = 'Recorridos disponibles y puntos de salida y llegada'
  */
  try {
    return res.json(await Recorrido.findAll({ where: { activo: true }, order: [['idRecorrido', 'ASC']] }));
  } catch {
    return res.status(500).json({ mensaje: 'No se pudieron cargar los recorridos' });
  }
};
