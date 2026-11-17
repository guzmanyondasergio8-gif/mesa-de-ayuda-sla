// Pruebas del middleware de autenticación y del manejador de errores
// Correr con: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'clave_de_prueba';
const { verificarToken, permitirRoles } = require('../src/middlewares/auth.middleware');
const { ErrorApp, manejarErrores } = require('../src/utils/errores');

// Respuesta falsa de Express que guarda lo que se respondió
function respuestaFalsa() {
  return {
    statusCode: null,
    body: null,
    status(codigo) { this.statusCode = codigo; return this; },
    json(datos) { this.body = datos; return this; }
  };
}

function ejecutar(middleware, req) {
  const res = respuestaFalsa();
  let siguio = false;
  middleware(req, res, () => { siguio = true; });
  return { res, siguio };
}

const conToken = (token) => ({ headers: { authorization: `Bearer ${token}` } });

test('sin token responde 401 TOKEN_NO_ENVIADO', () => {
  const { res, siguio } = ejecutar(verificarToken, { headers: {} });
  assert.equal(siguio, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.codigo, 'TOKEN_NO_ENVIADO');
});

test('con token válido deja pasar y carga req.usuario', () => {
  const token = jwt.sign({ sub: 7, nombre: 'Ana', rol: 'Agente' }, 'clave_de_prueba', { expiresIn: '15m' });
  const req = conToken(token);
  const { siguio } = ejecutar(verificarToken, req);
  assert.equal(siguio, true);
  assert.deepEqual(req.usuario, { id: 7, nombre: 'Ana', rol: 'Agente' });
});

test('token vencido responde 401 TOKEN_EXPIRADO', () => {
  const token = jwt.sign({ sub: 7, rol: 'Agente' }, 'clave_de_prueba', { expiresIn: -10 });
  const { res } = ejecutar(verificarToken, conToken(token));
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.codigo, 'TOKEN_EXPIRADO');
});

test('token firmado con otra clave responde 401 TOKEN_INVALIDO', () => {
  const token = jwt.sign({ sub: 7, rol: 'Administrador' }, 'otra_clave');
  const { res } = ejecutar(verificarToken, conToken(token));
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.codigo, 'TOKEN_INVALIDO');
});

test('permitirRoles deja pasar al Administrador y bloquea al Agente con 403', () => {
  const soloAdmin = permitirRoles('Administrador');
  assert.equal(ejecutar(soloAdmin, { usuario: { rol: 'Administrador' } }).siguio, true);
  const { res, siguio } = ejecutar(soloAdmin, { usuario: { rol: 'Agente' } });
  assert.equal(siguio, false);
  assert.equal(res.statusCode, 403);
});

test('manejarErrores responde los ErrorApp con su status y código', () => {
  const res = respuestaFalsa();
  manejarErrores(new ErrorApp(401, 'Sesión inválida', 'SIN_SESION'), {}, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Sesión inválida', codigo: 'SIN_SESION' });
});

test('manejarErrores traduce el error de PostgreSQL de agente inexistente', () => {
  const res = respuestaFalsa();
  manejarErrores({ code: '23503' }, {}, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'El agente indicado no existe.');
});

test('manejarErrores no expone detalles de errores inesperados', (t) => {
  t.mock.method(console, 'error', () => {});
  const res = respuestaFalsa();
  manejarErrores(new Error('detalle interno de la BD'), {}, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'Error interno del servidor.');
});
