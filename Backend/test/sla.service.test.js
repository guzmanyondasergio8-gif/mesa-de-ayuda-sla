// Pruebas de las reglas del SLA (no necesitan base de datos)
// Correr con: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  TIEMPOS_SLA_MINUTOS,
  normalizarPrioridad,
  normalizarEstado,
  calcularEstadoSla,
  agregarInfoSla
} = require('../src/services/sla.service');

test('cada prioridad tiene su tiempo de SLA', () => {
  assert.deepEqual(TIEMPOS_SLA_MINUTOS, { Baja: 1440, Media: 480, Alta: 120, 'Crítica': 30 });
});

test('la prioridad se reconoce sin importar tildes, mayúsculas ni espacios', () => {
  assert.equal(normalizarPrioridad('critica'), 'Crítica');
  assert.equal(normalizarPrioridad('CRÍTICA'), 'Crítica');
  assert.equal(normalizarPrioridad('  alta '), 'Alta');
  assert.equal(normalizarPrioridad('Urgente'), null);
  assert.equal(normalizarPrioridad(''), null);
  assert.equal(normalizarPrioridad(undefined), null);
});

test('el estado se reconoce sin importar mayúsculas', () => {
  assert.equal(normalizarEstado('en espera'), 'En Espera');
  assert.equal(normalizarEstado('RESUELTO'), 'Resuelto');
  assert.equal(normalizarEstado('Pendiente'), null);
});

test('semáforo de un ticket Alta (120 min)', () => {
  assert.deepEqual(calcularEstadoSla(120, 0), { minutosRestantes: 120, estadoSla: 'en_tiempo' });
  assert.deepEqual(calcularEstadoSla(120, 89), { minutosRestantes: 31, estadoSla: 'en_tiempo' });
  // Le queda exactamente el 25 % (30 min): pasa a amarillo
  assert.deepEqual(calcularEstadoSla(120, 90), { minutosRestantes: 30, estadoSla: 'por_vencer' });
  assert.deepEqual(calcularEstadoSla(120, 119), { minutosRestantes: 1, estadoSla: 'por_vencer' });
  // Se acabó el tiempo: rojo
  assert.deepEqual(calcularEstadoSla(120, 120), { minutosRestantes: 0, estadoSla: 'vencido' });
  assert.deepEqual(calcularEstadoSla(120, 150), { minutosRestantes: -30, estadoSla: 'vencido' });
});

test('un ticket Crítico (30 min) no nace en amarillo', () => {
  assert.equal(calcularEstadoSla(30, 0).estadoSla, 'en_tiempo');
  assert.equal(calcularEstadoSla(30, 22).estadoSla, 'en_tiempo');   // quedan 8 > 7.5
  assert.equal(calcularEstadoSla(30, 23).estadoSla, 'por_vencer');  // quedan 7
});

test('agregarInfoSla convierte la fila de la BD en lo que recibe el Frontend', () => {
  const ticket = agregarInfoSla({ id: 1, tiempo_limite_resolucion: 120, minutos_sla: 100 });
  assert.equal(ticket.tiempo_transcurrido_minutos, 100);
  assert.equal(ticket.minutos_restantes, 20);
  assert.equal(ticket.estado_sla, 'por_vencer');
  assert.equal('minutos_sla' in ticket, false, 'el campo interno no se expone');
});
