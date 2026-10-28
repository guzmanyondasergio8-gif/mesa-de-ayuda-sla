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

module.exports = {
  hashToken,
  generarAccessToken,
  generarRefreshToken,
  crearSesion
};
