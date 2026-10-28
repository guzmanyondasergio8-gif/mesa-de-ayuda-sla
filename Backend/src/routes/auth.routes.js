const express = require('express');
const router = express.Router();
const { login } = require('../controllers/auth.controller');

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión (devuelve access token y refresh token)
 *     tags: [Autenticación]
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

module.exports = router;
