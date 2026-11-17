// Pruebas de las validaciones de los servicios. Todas fallan ANTES de llegar
// a la base de datos, por eso no necesitan PostgreSQL.
// Correr con: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ticketService = require('../src/services/ticket.service');
const agenteService = require('../src/services/agente.service');
const { ErrorApp } = require('../src/utils/errores');

// Verifica que la promesa falle con un ErrorApp del status y mensaje esperados
async function debeFallar(promesa, status, mensaje) {
  await assert.rejects(promesa, (error) => {
    assert.ok(error instanceof ErrorApp, 'debe ser un ErrorApp');
    assert.equal(error.status, status);
    if (mensaje) assert.match(error.message, mensaje);
    return true;
  });
}

test('crear ticket: título, descripción y prioridad son obligatorios', async () => {
  await debeFallar(ticketService.crear({}), 400, /obligatorios/);
  await debeFallar(ticketService.crear({ titulo: 'x', descripcion: 'y' }), 400, /obligatorios/);
});

test('crear ticket: rechaza prioridades que no existen', async () => {
  await debeFallar(
    ticketService.crear({ titulo: 'x', descripcion: 'y', prioridad: 'Urgente' }),
    400,
    /Prioridad no válida/
  );
});

test('crear ticket: el agente_id debe ser un número', async () => {
  await debeFallar(
    ticketService.crear({ titulo: 'x', descripcion: 'y', prioridad: 'Alta', agente_id: 'abc' }),
    400,
    /agente_id/
  );
});

test('cambiar estado: valida el id, el cuerpo y el estado', async () => {
  await debeFallar(ticketService.cambiarEstado('abc', { estado: 'Abierto' }), 400, /id del ticket/);
  await debeFallar(ticketService.cambiarEstado('-1', { estado: 'Abierto' }), 400, /id del ticket/);
  await debeFallar(ticketService.cambiarEstado('1', {}), 400, /estado/);
  await debeFallar(ticketService.cambiarEstado('1', { estado: 'Pendiente' }), 400, /Estado no válido/);
  await debeFallar(ticketService.cambiarEstado('1', { en_espera: 'si' }), 400, /true o false/);
});

test('eliminar ticket: valida el id', async () => {
  await debeFallar(ticketService.eliminar('abc'), 400, /id del ticket/);
  await debeFallar(ticketService.eliminar('0'), 400, /id del ticket/);
});

test('crear agente: campos obligatorios, correo, rol y contraseña', async () => {
  const base = { nombre: 'Ana', correo: 'ana@empresa.com', password: 'Clave123' };
  await debeFallar(agenteService.crear({}), 400, /obligatorios/);
  await debeFallar(agenteService.crear({ ...base, correo: 'ana' }), 400, /correo/);
  await debeFallar(agenteService.crear({ ...base, rol: 'Jefe' }), 400, /Rol no válido/);
  await debeFallar(agenteService.crear({ ...base, password: '123' }), 400, /6 caracteres/);
});

test('el correo se guarda en minúsculas y sin espacios', () => {
  assert.equal(agenteService.normalizarCorreo('  Ana@Empresa.COM '), 'ana@empresa.com');
});

test('propiedad del recurso: quién puede gestionar un ticket', () => {
  const { puedeGestionar } = ticketService;
  const admin = { id: 1, rol: 'Administrador' };
  const ana = { id: 7, rol: 'Agente' };
  assert.equal(puedeGestionar(admin, 99), true, 'el Administrador gestiona cualquiera');
  assert.equal(puedeGestionar(ana, 7), true, 'el Agente gestiona los suyos');
  assert.equal(puedeGestionar(ana, null), true, 'el Agente gestiona los sin asignar');
  assert.equal(puedeGestionar(ana, 8), false, 'el Agente NO gestiona los de otro');
});
