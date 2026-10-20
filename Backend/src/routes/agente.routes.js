const express = require('express');
const router = express.Router();
const { getAgentes, getAgenteById, createAgente } = require('../controllers/agente.controller');

/**
 * @openapi
 * components:
 *   schemas:
 *     Agente:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         nombre:
 *           type: string
 *           example: María López
 *         correo:
 *           type: string
 *           example: maria@empresa.com
 *         rol:
 *           type: string
 *           enum: [Agente, Administrador]
 */

/**
 * @openapi
 * /api/agentes:
 *   get:
 *     summary: Listar agentes de soporte
 *     responses:
 *       200:
 *         description: Lista de agentes.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Agente'
 *   post:
 *     summary: Crear un agente de soporte
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - correo
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: María López
 *               correo:
 *                 type: string
 *                 example: maria@empresa.com
 *               rol:
 *                 type: string
 *                 enum: [Agente, Administrador]
 *                 example: Agente
 *     responses:
 *       201:
 *         description: Agente creado.
 *       400:
 *         description: Datos faltantes, correo inválido o rol no válido.
 *       409:
 *         description: Ya existe un agente con ese correo.
 */
router.get('/', getAgentes);
router.post('/', createAgente);

/**
 * @openapi
 * /api/agentes/{id}:
 *   get:
 *     summary: Obtener un agente por id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Agente encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agente'
 *       404:
 *         description: Agente no encontrado.
 */
router.get('/:id', getAgenteById);

module.exports = router;