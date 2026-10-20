const express = require('express');
const router = express.Router();
const { getCatalogos } = require('../controllers/catalogo.controller');

/**
 * @openapi
 * /api/catalogos:
 *   get:
 *     summary: Obtener prioridades, estados y estados de SLA válidos
 *     description: Valores para llenar los selects del formulario y los filtros del dashboard.
 *     responses:
 *       200:
 *         description: Catálogos del sistema.
 *         content:
 *           application/json:
 *             example:
 *               prioridades:
 *                 - { nombre: Baja, minutos_sla: 1440 }
 *                 - { nombre: Media, minutos_sla: 480 }
 *                 - { nombre: Alta, minutos_sla: 120 }
 *                 - { nombre: Crítica, minutos_sla: 30 }
 *               estados: [Abierto, En Progreso, En Espera, Resuelto, Cerrado]
 *               estados_sla:
 *                 - { valor: en_tiempo, etiqueta: En Tiempo, color: verde }
 *                 - { valor: por_vencer, etiqueta: Por Vencer, color: amarillo }
 *                 - { valor: vencido, etiqueta: Vencido, color: rojo }
 */
router.get('/', getCatalogos);

module.exports = router;