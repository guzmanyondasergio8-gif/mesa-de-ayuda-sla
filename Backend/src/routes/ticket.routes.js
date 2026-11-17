const express = require('express');
const router = express.Router();
const {
  getTickets,
  getTicketById,
  getHistorial,
  createTicket,
  deleteTicket,
  deleteTodos,
  updateTicketStatus
} = require('../controllers/ticket.controller');
const { permitirRoles } = require('../middlewares/auth.middleware');

/**
 * @openapi
 * components:
 *   schemas:
 *     Ticket:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         titulo:
 *           type: string
 *           example: Falla en impresora de contabilidad
 *         descripcion:
 *           type: string
 *           example: La impresora no enciende desde la mañana
 *         prioridad:
 *           type: string
 *           enum: [Baja, Media, Alta, Crítica]
 *         estado:
 *           type: string
 *           enum: [Abierto, En Progreso, En Espera, Resuelto, Cerrado]
 *         agente_id:
 *           type: integer
 *           nullable: true
 *         agente_nombre:
 *           type: string
 *           nullable: true
 *           description: Nombre del agente asignado
 *           example: María López
 *         minutos_desde_creacion:
 *           type: integer
 *           description: Minutos desde que se creó el ticket (incluye pausas)
 *         escalado:
 *           type: boolean
 *           description: true si el ticket venció y quedó registrado en el historial de escalados
 *         tiempo_limite_resolucion:
 *           type: integer
 *           description: Minutos totales del SLA según la prioridad
 *           example: 120
 *         tiempo_transcurrido_minutos:
 *           type: integer
 *           description: Minutos de SLA consumidos (sin contar pausas), calculados en tiempo real
 *           example: 45
 *         minutos_restantes:
 *           type: integer
 *           description: Minutos que faltan para vencer (negativo si ya venció)
 *           example: 75
 *         estado_sla:
 *           type: string
 *           enum: [en_tiempo, por_vencer, vencido]
 *           description: Verde, amarillo (queda 25% o menos) o rojo
 *         en_espera:
 *           type: boolean
 *         pausado_desde:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         minutos_pausados:
 *           type: integer
 *         fecha_resolucion:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         fecha_creacion:
 *           type: string
 *           format: date-time
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/tickets:
 *   get:
 *     summary: Obtener lista de tickets con su estado de SLA calculado en tiempo real
 *     responses:
 *       200:
 *         description: Lista de tickets registrados.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Ticket'
 *   post:
 *     summary: Crear un nuevo ticket (el tiempo de SLA se asigna según la prioridad)
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
 *                 enum: [Baja, Media, Alta, Crítica]
 *                 example: Alta
 *               agente_id:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Ticket creado exitosamente.
 *       400:
 *         description: Datos faltantes, prioridad no válida o agente inexistente.
 */
router.get('/', getTickets);
router.post('/', createTicket);

/**
 * @openapi
 * /api/tickets:
 *   delete:
 *     summary: Eliminar TODOS los tickets (solo Administrador)
 *     description: Borra los tickets y su historial de escalados; la numeración vuelve a empezar en 1. Avisa por socket con tickets:limpiados.
 *     responses:
 *       200:
 *         description: Tickets eliminados.
 *       403:
 *         description: Requiere rol Administrador.
 */
router.delete('/', permitirRoles('Administrador'), deleteTodos);

/**
 * @openapi
 * /api/tickets/{id}:
 *   get:
 *     summary: Obtener un ticket por id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ticket encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ticket'
 *       404:
 *         description: Ticket no encontrado.
 *   put:
 *     summary: Actualizar el estado o pausar/reanudar el reloj del SLA
 *     description: |
 *       - Estado "En Espera" o en_espera true: pausa el reloj del SLA.
 *       - Volver a "Abierto" o "En Progreso": reanuda el reloj (el tiempo pausado no cuenta).
 *       - "Resuelto" o "Cerrado": detiene el reloj definitivamente.
 *       - Un Agente solo puede cambiar tickets asignados a él o sin asignar (si no, 403).
 *         El Administrador puede cambiar cualquiera.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [Abierto, En Progreso, En Espera, Resuelto, Cerrado]
 *                 example: En Espera
 *               en_espera:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Ticket actualizado exitosamente.
 *       400:
 *         description: Estado no válido o datos incorrectos.
 *       403:
 *         description: El ticket está asignado a otro agente.
 *       404:
 *         description: Ticket no encontrado.
 */
router.get('/:id', getTicketById);

/**
 * @openapi
 * /api/tickets/{id}/historial:
 *   get:
 *     summary: Historial de escalados del ticket
 *     description: Cuando un ticket vence, el monitor del SLA lo registra aquí automáticamente.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de escalados (vacía si nunca venció).
 *         content:
 *           application/json:
 *             example:
 *               - { id: 1, ticket_id: 4, motivo: "SLA vencido: prioridad Crítica, límite de 30 min", fecha_evento: "2026-11-11T15:30:00.000Z" }
 *       404:
 *         description: Ticket no encontrado.
 */
router.get('/:id/historial', getHistorial);
router.put('/:id', updateTicketStatus);

/**
 * @openapi
 * /api/tickets/{id}:
 *   delete:
 *     summary: Eliminar un ticket (solo Administrador)
 *     description: También borra su historial de escalados. Avisa por socket con ticket:eliminado.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ticket eliminado.
 *       403:
 *         description: Requiere rol Administrador.
 *       404:
 *         description: Ticket no encontrado.
 */
router.delete('/:id', permitirRoles('Administrador'), deleteTicket);

module.exports = router;