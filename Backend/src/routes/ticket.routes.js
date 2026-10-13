const express = require('express');
const router = express.Router();
const { getTickets, createTicket } = require('../controllers/ticket.controller');

/**
 * @openapi
 * /api/tickets:
 *   get:
 *     summary: Obtener lista de tickets
 *     responses:
 *       200:
 *         description: Lista de tickets registrados.
 *   post:
 *     summary: Crear un nuevo ticket
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - titulo
 *               - descripcion
 *               - prioridad
 *             properties:
 *               titulo:
 *                 type: string
 *                 example: Falla en impresora de contabilidad
 *               descripcion:
 *                 type: string
 *                 example: La impresora no enciende desde la mañana
 *               prioridad:
 *                 type: string
 *                 example: Alta
 *     responses:
 *       201:
 *         description: Ticket creado exitosamente.
 */
router.get('/', getTickets);
router.post('/', createTicket);

module.exports = router;