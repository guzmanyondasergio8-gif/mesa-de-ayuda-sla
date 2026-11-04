const express = require('express');
const router = express.Router();
const { login, refresh, logout, perfil } = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión (devuelve access token y refresh token)
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [correo, password]
 *             properties:
 *               correo:
 *                 type: string
 *                 example: maria@empresa.com
 *               password:
 *                 type: string
 *                 example: Clave123
 *     responses:
 *       200:
 *         description: Login correcto.
 *         content:
 *           application/json:
 *             example:
 *               access_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               refresh_token: 9f2c4e...
 *               token_type: Bearer
 *               expires_in: 900
 *               agente: { id: 1, nombre: María López, correo: maria@empresa.com, rol: Agente }
 *       400:
 *         description: Faltan correo o contraseña.
 *       401:
 *         description: Correo o contraseña incorrectos.
 */
router.post('/login', login);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Renovar la sesión con el refresh token (devuelve tokens nuevos)
 *     description: |
 *       Cada refresh token sirve una sola vez: al usarlo se revoca y se entrega uno nuevo.
 *       Si se intenta usar uno ya revocado, se cierran todas las sesiones del agente.
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 example: 9f2c4e...
 *     responses:
 *       200:
 *         description: Sesión renovada (misma forma de respuesta que el login).
 *       400:
 *         description: Falta el refresh_token.
 *       401:
 *         description: Refresh token inválido, expirado o ya utilizado.
 */
router.post('/refresh', refresh);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión (elimina el refresh token)
 *     tags: [Autenticación]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 example: 9f2c4e...
 *     responses:
 *       200:
 *         description: Sesión cerrada.
 *       400:
 *         description: Falta el refresh_token.
 */
router.post('/logout', logout);

/**
 * @openapi
 * /api/auth/perfil:
 *   get:
 *     summary: Datos del agente que inició sesión (requiere token)
 *     tags: [Autenticación]
 *     responses:
 *       200:
 *         description: Datos del agente.
 *         content:
 *           application/json:
 *             example: { id: 1, nombre: Sergio Guzmán, correo: sergio@empresa.com, rol: Administrador }
 *       401:
 *         description: Token no enviado, inválido o expirado.
 */
router.get('/perfil', verificarToken, perfil);

module.exports = router;
