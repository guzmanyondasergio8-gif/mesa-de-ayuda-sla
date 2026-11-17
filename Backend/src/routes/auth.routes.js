const express = require('express');
const router = express.Router();
const { login, refresh, logout, perfil } = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     description: |
 *       Devuelve el access token en el JSON y deja el refresh token en una cookie HttpOnly
 *       (`refresh_token`), que el navegador envía solo a /api/auth y que JavaScript no puede leer.
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
 *     summary: Renovar la sesión con la cookie del refresh token
 *     description: |
 *       No lleva cuerpo: el navegador envía la cookie `refresh_token` automáticamente.
 *       Devuelve un access token nuevo y cambia la cookie por un refresh token nuevo (rotación):
 *       cada refresh token sirve una sola vez. Si se reutiliza uno viejo, se cierran todas
 *       las sesiones del agente. En Swagger funciona después de hacer login aquí mismo.
 *     tags: [Autenticación]
 *     security: []
 *     responses:
 *       200:
 *         description: Sesión renovada (misma forma de respuesta que el login).
 *       401:
 *         description: Sin cookie, sesión inválida, expirada o reutilizada (campo codigo = SIN_SESION o SESION_REUTILIZADA).
 */
router.post('/refresh', refresh);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     description: Elimina el refresh token de la base de datos y borra la cookie. No lleva cuerpo.
 *     tags: [Autenticación]
 *     security: []
 *     responses:
 *       200:
 *         description: Sesión cerrada.
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
