// Controlador de tickets: solo traduce HTTP <-> servicio.
// Validaciones y reglas del SLA: services/ticket.service.js
const ticketService = require('../services/ticket.service');
const { conManejo } = require('../utils/errores');

const getTickets = conManejo(async (req, res) => {
  res.json(await ticketService.listar());
});

const getTicketById = conManejo(async (req, res) => {
  res.json(await ticketService.obtener(req.params.id));
});

const getHistorial = conManejo(async (req, res) => {
  res.json(await ticketService.historial(req.params.id));
});

const createTicket = conManejo(async (req, res) => {
  const ticket = await ticketService.crear(req.body);
  res.status(201).json({ mensaje: 'Ticket creado con éxito', ticket });
});

const updateTicketStatus = conManejo(async (req, res) => {
  const ticket = await ticketService.cambiarEstado(req.params.id, req.body, req.usuario);
  res.json({ mensaje: 'Estado del ticket actualizado', ticket });
});

const deleteTicket = conManejo(async (req, res) => {
  await ticketService.eliminar(req.params.id);
  res.json({ mensaje: 'Ticket eliminado' });
});

const deleteTodos = conManejo(async (req, res) => {
  await ticketService.eliminarTodos();
  res.json({ mensaje: 'Se eliminaron todos los tickets' });
});

module.exports = {
  deleteTicket,
  deleteTodos,
  getTickets,
  getTicketById,
  getHistorial,
  createTicket,
  updateTicketStatus
};
