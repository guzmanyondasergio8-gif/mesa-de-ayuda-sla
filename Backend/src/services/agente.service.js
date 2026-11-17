// Reglas de negocio de los agentes: validaciones y contraseña encriptada
const bcrypt = require('bcryptjs');
const agenteRepo = require('../repositories/agente.repository');
const { ErrorApp } = require('../utils/errores');

const ROLES = ['Agente', 'Administrador'];
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 6;

function normalizarCorreo(correo) {
  return String(correo).trim().toLowerCase();
}

async function hashPassword(password) {
  if (String(password).length < PASSWORD_MIN) {
    throw new ErrorApp(400, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
  }
  // La contraseña nunca se guarda en texto plano, solo su hash
  return bcrypt.hash(String(password), 10);
}

async function listar() {
  return agenteRepo.listar();
}

async function obtener(idTexto) {
  const id = Number(idTexto);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErrorApp(400, 'El id del agente debe ser un número entero positivo.');
  }
  const agente = await agenteRepo.buscarPorId(id);
  if (!agente) throw new ErrorApp(404, 'Agente no encontrado');
  return agente;
}

async function crear({ nombre, correo, rol, password }) {
  if (!nombre || !correo || !password) {
    throw new ErrorApp(400, 'Nombre, correo y contraseña son obligatorios.');
  }
  if (!REGEX_CORREO.test(correo)) {
    throw new ErrorApp(400, 'El correo no tiene un formato válido.');
  }
  const rolFinal = rol || 'Agente';
  if (!ROLES.includes(rolFinal)) {
    throw new ErrorApp(400, `Rol no válido. Valores permitidos: ${ROLES.join(', ')}.`);
  }

  const passwordHash = await hashPassword(password);
  try {
    return await agenteRepo.crear({
      nombre: String(nombre).trim(),
      correo: normalizarCorreo(correo),
      rol: rolFinal,
      passwordHash
    });
  } catch (error) {
    // 23505 = el correo ya está registrado (columna UNIQUE)
    if (error.code === '23505') throw new ErrorApp(409, 'Ya existe un agente con ese correo.');
    throw error;
  }
}

// Usado por el script crear-admin
async function crearOActualizarAdmin({ nombre, correo, password }) {
  if (!REGEX_CORREO.test(correo)) {
    throw new ErrorApp(400, 'El correo no tiene un formato válido.');
  }
  return agenteRepo.crearOActualizarAdmin({
    nombre: String(nombre).trim(),
    correo: normalizarCorreo(correo),
    passwordHash: await hashPassword(password)
  });
}

module.exports = { ROLES, listar, obtener, crear, crearOActualizarAdmin, normalizarCorreo };
