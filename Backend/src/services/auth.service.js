// Lógica del login con doble token:
//  - Access token: JWT firmado, dura poco (15 min). El Frontend lo guarda EN MEMORIA
//    y lo envía en cada petición (Authorization: Bearer <token>).
//  - Refresh token: texto aleatorio, dura 7 días. Viaja en una cookie HttpOnly, así
//    el JavaScript de la página no lo puede leer (protección contra XSS).
//    En la base de datos se guarda solo su hash.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { conTransaccion } = require('../config/db');
const agenteRepo = require('../repositories/agente.repository');
const refreshRepo = require('../repositories/refreshToken.repository');
const { normalizarCorreo } = require('./agente.service');
const { ErrorApp } = require('../utils/errores');

const ACCESS_TOKEN_DURACION = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_DIAS = Number(process.env.JWT_REFRESH_DAYS) || 7;

// Mismo mensaje para correo inexistente o contraseña incorrecta,
// así no se revela qué correos están registrados
const ERROR_CREDENCIALES = 'Correo o contraseña incorrectos.';

// Convierte '15m', '1h' o '900' (segundos) en segundos, para informar al Frontend
function duracionEnSegundos(valor) {
  const match = String(valor).match(/^(\d+)([smhd]?)$/);
  if (!match) return null;
  const factor = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
  return Number(match[1]) * factor;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

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
  await refreshRepo.crear(agenteId, hashToken(token), REFRESH_TOKEN_DIAS);
  return token;
}

// Sesión nueva: el controlador manda accessToken en el JSON y refreshToken en la cookie
async function crearSesion(agente) {
  return {
    accessToken: generarAccessToken(agente),
    refreshToken: await generarRefreshToken(agente.id),
    expiresIn: duracionEnSegundos(ACCESS_TOKEN_DURACION),
    agente: { id: agente.id, nombre: agente.nombre, correo: agente.correo, rol: agente.rol }
  };
}

async function login(correo, password) {
  if (!correo || !password) {
    throw new ErrorApp(400, 'Correo y contraseña son obligatorios.');
  }

  const agente = await agenteRepo.buscarPorCorreoConPassword(normalizarCorreo(correo));

  // Agentes creados antes del login no tienen contraseña y no pueden entrar
  if (!agente || !agente.password_hash) throw new ErrorApp(401, ERROR_CREDENCIALES);
  if (!(await bcrypt.compare(String(password), agente.password_hash))) {
    throw new ErrorApp(401, ERROR_CREDENCIALES);
  }

  return crearSesion(agente);
}

// Cambia un refresh token válido por una sesión nueva (rotación):
//  - El token usado se revoca, así cada refresh token sirve UNA sola vez.
//  - Si llega un token ya revocado, alguien pudo haberlo copiado: por seguridad
//    se revocan todas las sesiones de ese agente y debe volver a iniciar sesión.
async function renovarSesion(refreshToken) {
  if (!refreshToken) {
    throw new ErrorApp(401, 'No hay una sesión activa.', 'SIN_SESION');
  }

  const resultado = await conTransaccion(async (client) => {
    const registro = await refreshRepo.bloquearPorHash(client, hashToken(refreshToken));
    if (!registro) return { error: 'Sesión inválida. Inicia sesión de nuevo.' };
    if (registro.revocado) return { reuso: registro.agente_id };
    if (registro.expirado) return { error: 'La sesión expiró. Inicia sesión de nuevo.' };

    await refreshRepo.revocar(client, registro.id);
    return {
      agente: {
        id: registro.agente_id,
        nombre: registro.nombre,
        correo: registro.correo,
        rol: registro.rol
      }
    };
  });

  if (resultado.reuso) {
    await refreshRepo.revocarTodosDeAgente(resultado.reuso);
    throw new ErrorApp(
      401,
      'Sesión ya utilizada. Por seguridad se cerraron todas tus sesiones.',
      'SESION_REUTILIZADA'
    );
  }
  if (resultado.error) throw new ErrorApp(401, resultado.error, 'SIN_SESION');

  return crearSesion(resultado.agente);
}

// Cerrar sesión: elimina el refresh token. Si no existe, no pasa nada.
async function cerrarSesion(refreshToken) {
  if (refreshToken) await refreshRepo.eliminarPorHash(hashToken(refreshToken));
}

async function perfil(agenteId) {
  const agente = await agenteRepo.buscarPorId(agenteId);
  if (!agente) throw new ErrorApp(404, 'Agente no encontrado');
  return agente;
}

module.exports = {
  REFRESH_TOKEN_DIAS,
  login,
  renovarSesion,
  cerrarSesion,
  perfil
};
