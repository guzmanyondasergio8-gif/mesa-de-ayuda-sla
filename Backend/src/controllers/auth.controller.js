const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { crearSesion, renovarSesion, revocarRefreshToken } = require('../services/auth.service');

// Mismo mensaje para correo inexistente o contraseña incorrecta,
// así no se revela qué correos están registrados
const ERROR_CREDENCIALES = 'Correo o contraseña incorrectos.';

// POST /api/auth/login
const login = async (req, res) => {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, nombre, correo, rol, password_hash FROM agentes WHERE correo = $1',
      [String(correo).trim().toLowerCase()]
    );
    const agente = result.rows[0];

    // Agentes creados antes del login no tienen contraseña y no pueden entrar
    if (!agente || !agente.password_hash) {
      return res.status(401).json({ error: ERROR_CREDENCIALES });
    }

    const passwordCorrecta = await bcrypt.compare(String(password), agente.password_hash);
    if (!passwordCorrecta) {
      return res.status(401).json({ error: ERROR_CREDENCIALES });
    }

    res.json(await crearSesion(agente));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/auth/refresh — cambia el refresh token por una sesión nueva
const refresh = async (req, res) => {
  try {
    res.json(await renovarSesion(req.body.refresh_token));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

// POST /api/auth/logout — revoca el refresh token para que no se pueda volver a usar
const logout = async (req, res) => {
  try {
    await revocarRefreshToken(req.body.refresh_token);
    res.json({ mensaje: 'Sesión cerrada' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

module.exports = { login, refresh, logout };
