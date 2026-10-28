const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const ROLES = ['Agente', 'Administrador'];
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 6;

// 1. Listar todos los agentes
const getAgentes = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, correo, rol FROM agentes ORDER BY nombre'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Obtener un agente por id
const getAgenteById = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'El id del agente debe ser un número entero positivo.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, nombre, correo, rol FROM agentes WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agente no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Crear un agente
const createAgente = async (req, res) => {
  const { nombre, correo, rol, password } = req.body;

  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
  }

  if (String(password).length < PASSWORD_MIN) {
    return res.status(400).json({ error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.` });
  }

  if (!REGEX_CORREO.test(correo)) {
    return res.status(400).json({ error: 'El correo no tiene un formato válido.' });
  }

  const rolFinal = rol || 'Agente';
  if (!ROLES.includes(rolFinal)) {
    return res.status(400).json({ error: `Rol no válido. Valores permitidos: ${ROLES.join(', ')}.` });
  }

  try {
    // La contraseña nunca se guarda en texto plano, solo su hash
    const passwordHash = await bcrypt.hash(String(password), 10);

    const result = await pool.query(
      `INSERT INTO agentes (nombre, correo, rol, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, correo, rol`,
      [nombre.trim(), correo.trim().toLowerCase(), rolFinal, passwordHash]
    );

    res.status(201).json({
      mensaje: 'Agente creado con éxito',
      agente: result.rows[0]
    });
  } catch (error) {
    // 23505 = el correo ya está registrado (columna UNIQUE)
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un agente con ese correo.' });
    }
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  ROLES,
  getAgentes,
  getAgenteById,
  createAgente
};