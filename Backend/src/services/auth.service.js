// Lógica del login con doble token:
//  - Access token: JWT firmado, dura poco (15 min). Se envía en cada petición.
//  - Refresh token: texto aleatorio, dura 7 días. Sirve para pedir un access token nuevo.
//    En la base de datos se guarda solo su hash, así un robo de la BD no expone los tokens.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const ACCESS_TOKEN_DURACION = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_DIAS = Number(process.env.JWT_REFRESH_DAYS) || 7;

// Convierte '15m', '1h' o '900' (segundos) en segundos, para informar al Frontend
function duracionEnSegundos(valor) {
  const match = String(valor).match(/^(\d+)([smhd]?)$/);
  if (!match) return null;
  const factor = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
  return Number(match[1]) * factor;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Crea el JWT con los datos mínimos del agente
function generarAccessToken(agente) {
  return jwt.sign(
    { sub: agente.id, nombre: agente.nombre, rol: agente.rol },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_DURACION }
  );
}

// Crea un refresh token aleatorio y guarda su hash en la BD
async function generarRefreshToken(agenteId) {
  const token = crypto.randomBytes(48).toString('hex');
  await pool.query(
    `INSERT INTO refresh_tokens (agente_id, token_hash, expira_en)
     VALUES ($1, $2, LOCALTIMESTAMP + make_interval(days => $3))`,
    [agenteId, hashToken(token), REFRESH_TOKEN_DIAS]
  );
  return token;
}

// Respuesta estándar de login (y luego de refresh)
async function crearSesion(agente) {
  return {
    access_token: generarAccessToken(agente),
    refresh_token: await generarRefreshToken(agente.id),
    token_type: 'Bearer',
    expires_in: duracionEnSegundos(ACCESS_TOKEN_DURACION),
    agente: {
      id: agente.id,
      nombre: agente.nombre,
      correo: agente.correo,
      rol: agente.rol
    }
  };
}

// Error con código HTTP, para que el controlador sepa qué responder
class ErrorSesion extends Error {
  constructor(mensaje, status = 401) {
    super(mensaje);
    this.status = status;
  }
}

// Cambia un refresh token válido por una sesión nueva (rotación):
//  - El token usado se revoca, así cada refresh token sirve UNA sola vez.
//  - Si llega un token ya revocado, alguien pudo haberlo copiado: por seguridad
//    se revocan todas las sesiones de ese agente y debe volver a iniciar sesión.
async function renovarSesion(refreshToken) {
  if (!refreshToken) {
    throw new ErrorSesion('El refresh_token es obligatorio.', 400);
  }

  let agente;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE: si llegan dos renovaciones con el mismo token a la vez, solo una gana
    const result = await client.query(
      `SELECT rt.id, rt.agente_id, rt.revocado, rt.expira_en < LOCALTIMESTAMP AS expirado,
              a.nombre, a.correo, a.rol
       FROM refresh_tokens rt
       JOIN agentes a ON a.id = rt.agente_id
       WHERE rt.token_hash = $1
       FOR UPDATE OF rt`,
      [hashToken(String(refreshToken))]
    );
    const registro = result.rows[0];

    if (!registro) {
      throw new ErrorSesion('Refresh token inválido.');
    }

    if (registro.revocado) {
      await client.query(
        'UPDATE refresh_tokens SET revocado = TRUE WHERE agente_id = $1',
        [registro.agente_id]
      );
      await client.query('COMMIT');
      throw new ErrorSesion('Refresh token ya utilizado. Por seguridad se cerraron todas tus sesiones.');
    }

    if (registro.expirado) {
      throw new ErrorSesion('Refresh token expirado. Inicia sesión de nuevo.');
    }

    await client.query('UPDATE refresh_tokens SET revocado = TRUE WHERE id = $1', [registro.id]);
    await client.query('COMMIT');

    // Datos actuales del agente (por si le cambiaron el rol desde el último login)
    agente = {
      id: registro.agente_id,
      nombre: registro.nombre,
      correo: registro.correo,
      rol: registro.rol
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  return crearSesion(agente);
}

// Cerrar sesión: elimina el refresh token, así ya no sirve para renovar.
// Si no existe, no pasa nada (cerrar sesión dos veces no es un error).
async function revocarRefreshToken(refreshToken) {
  if (!refreshToken) {
    throw new ErrorSesion('El refresh_token es obligatorio.', 400);
  }
  await pool.query(
    'DELETE FROM refresh_tokens WHERE token_hash = $1',
    [hashToken(String(refreshToken))]
  );
}

module.exports = {
  ErrorSesion,
  hashToken,
  generarAccessToken,
  generarRefreshToken,
  crearSesion,
  renovarSesion,
  revocarRefreshToken
};
