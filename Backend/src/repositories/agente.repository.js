// Acceso a datos de la tabla agentes. Nunca devuelve password_hash,
// salvo buscarPorCorreoConPassword, que solo usa el login.
const pool = require('../config/db');

async function listar() {
  const { rows } = await pool.query('SELECT id, nombre, correo, rol FROM agentes ORDER BY nombre');
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT id, nombre, correo, rol FROM agentes WHERE id = $1', [id]);
  return rows[0] || null;
}

async function buscarPorCorreoConPassword(correo) {
  const { rows } = await pool.query(
    'SELECT id, nombre, correo, rol, password_hash FROM agentes WHERE correo = $1',
    [correo]
  );
  return rows[0] || null;
}

async function crear({ nombre, correo, rol, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO agentes (nombre, correo, rol, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, correo, rol`,
    [nombre, correo, rol, passwordHash]
  );
  return rows[0];
}

// Crea un administrador o, si el correo ya existe, lo convierte en administrador
async function crearOActualizarAdmin({ nombre, correo, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO agentes (nombre, correo, rol, password_hash)
     VALUES ($1, $2, 'Administrador', $3)
     ON CONFLICT (correo) DO UPDATE
       SET nombre = EXCLUDED.nombre,
           rol = 'Administrador',
           password_hash = EXCLUDED.password_hash
     RETURNING id, nombre, correo, rol`,
    [nombre, correo, passwordHash]
  );
  return rows[0];
}

module.exports = {
  listar,
  buscarPorId,
  buscarPorCorreoConPassword,
  crear,
  crearOActualizarAdmin
};
