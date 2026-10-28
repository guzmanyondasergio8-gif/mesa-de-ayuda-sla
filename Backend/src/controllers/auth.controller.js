const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { crearSesion } = require('../services/auth.service');

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

module.exports = { login };
