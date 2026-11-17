// Controlador de agentes: solo traduce HTTP <-> servicio
const agenteService = require('../services/agente.service');
const { conManejo } = require('../utils/errores');

const getAgentes = conManejo(async (req, res) => {
  res.json(await agenteService.listar());
});

const getAgenteById = conManejo(async (req, res) => {
  res.json(await agenteService.obtener(req.params.id));
});

const createAgente = conManejo(async (req, res) => {
  const agente = await agenteService.crear(req.body);
  res.status(201).json({ mensaje: 'Agente creado con éxito', agente });
});

module.exports = { getAgentes, getAgenteById, createAgente };
