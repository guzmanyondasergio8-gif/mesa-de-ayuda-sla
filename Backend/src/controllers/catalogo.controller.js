// Controlador de catálogos: solo traduce HTTP <-> servicio
const catalogoService = require('../services/catalogo.service');

const getCatalogos = (req, res) => {
  res.json(catalogoService.obtener());
};

module.exports = { getCatalogos };
