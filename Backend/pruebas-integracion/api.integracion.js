// Pruebas de integración: levantan la API real contra PostgreSQL y la usan por HTTP.
// Usan una base de datos APARTE (MesaAyuda_pruebas) que se crea al empezar y se
// borra al terminar, así que nunca tocan tus tickets reales.
//
// Requisitos: PostgreSQL encendido y el .env del Backend configurado.
// Correr con (desde Backend):  npm run test:integracion
const path = require('path');
const http = require('http');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const BD_PRUEBAS = 'MesaAyuda_pruebas';
process.env.DB_NAME = BD_PRUEBAS;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'clave_de_pruebas';
process.env.SLA_MONITOR_SEGUNDOS = '1';

const conexionAdmin = () =>
  new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres'
  });

async function recrearBaseDePruebas(crear) {
  const admin = conexionAdmin();
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${BD_PRUEBAS}"`);
  if (crear) await admin.query(`CREATE DATABASE "${BD_PRUEBAS}"`);
  await admin.end();
}

let pool, servidor, base, monitorSla, eventos, EVENTOS;
const recibidos = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(metodo, ruta, { body, token, cookie } = {}) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = res.headers.get('set-cookie') || '';
  return {
    status: res.status,
    data: await res.json().catch(() => ({})),
    setCookie,
    cookie: (setCookie.match(/refresh_token=[^;]*/) || [''])[0]
  };
}

const login = (correo, password = 'Clave123') =>
  req('POST', '/api/auth/login', { body: { correo, password } });

before(async () => {
  await recrearBaseDePruebas(true);

  // Se cargan DESPUÉS de cambiar DB_NAME, para que usen la base de pruebas
  pool = require('../src/config/db');
  const runMigrations = require('../src/config/migrate');
  const app = require('../src/app');
  const agenteService = require('../src/services/agente.service');
  monitorSla = require('../src/services/monitorSla.service');
  ({ eventos, EVENTOS } = require('../src/services/eventos'));

  await runMigrations();
  await agenteService.crearOActualizarAdmin({ nombre: 'Admin Pruebas', correo: 'admin@pruebas.com', password: 'Clave123' });

  servidor = http.createServer(app).listen(0);
  base = `http://localhost:${servidor.address().port}`;
  for (const nombre of Object.values(EVENTOS)) eventos.on(nombre, (d) => recibidos.push([nombre, d]));
  monitorSla.iniciar();
});

after(async () => {
  monitorSla.detener();
  servidor.close();
  await pool.end();
  await recrearBaseDePruebas(false);
});

// ---------------------------------------------------------------------------
test('login: devuelve el access token y deja el refresh en una cookie HttpOnly', async () => {
  const r = await login('ADMIN@pruebas.com');
  assert.equal(r.status, 200);
  assert.ok(r.data.access_token);
  assert.equal('refresh_token' in r.data, false, 'el refresh token no viaja en el JSON');
  assert.match(r.setCookie, /HttpOnly/i);
  assert.match(r.setCookie, /SameSite=Strict/i);
  assert.match(r.setCookie, /Path=\/api\/auth/);

  assert.equal((await login('admin@pruebas.com', 'mala')).status, 401);
  assert.equal((await req('POST', '/api/auth/login', { body: {} })).status, 400);
});

test('refresh: rota el token y detecta la reutilización', async () => {
  const c1 = (await login('admin@pruebas.com')).cookie;
  const r = await req('POST', '/api/auth/refresh', { cookie: c1 });
  assert.equal(r.status, 200);
  assert.ok(r.cookie && r.cookie !== c1, 'entrega un refresh token nuevo');

  const reuso = await req('POST', '/api/auth/refresh', { cookie: c1 });
  assert.equal(reuso.status, 401);
  assert.equal(reuso.data.codigo, 'SESION_REUTILIZADA');
  assert.equal((await req('POST', '/api/auth/refresh', { cookie: r.cookie })).status, 401, 'cierra también la sesión nueva');
  assert.equal((await req('POST', '/api/auth/refresh')).data.codigo, 'SIN_SESION');
});

test('logout: elimina el refresh token', async () => {
  const c = (await login('admin@pruebas.com')).cookie;
  const r = await req('POST', '/api/auth/logout', { cookie: c });
  assert.equal(r.status, 200);
  assert.match(r.setCookie, /refresh_token=;/);
  assert.equal((await req('POST', '/api/auth/refresh', { cookie: c })).status, 401);
});

// ---------------------------------------------------------------------------
let admin, ana, beto, anaId;

test('rutas protegidas y roles', async () => {
  admin = (await login('admin@pruebas.com')).data.access_token;
  assert.equal((await req('GET', '/api/tickets')).data.codigo, 'TOKEN_NO_ENVIADO');
  assert.equal((await req('GET', '/api/tickets', { token: 'basura' })).data.codigo, 'TOKEN_INVALIDO');

  let r = await req('POST', '/api/agentes', { token: admin, body: { nombre: 'Ana', correo: 'ana@pruebas.com', password: 'Clave123' } });
  assert.equal(r.status, 201);
  anaId = r.data.agente.id;
  await req('POST', '/api/agentes', { token: admin, body: { nombre: 'Beto', correo: 'beto@pruebas.com', password: 'Clave123' } });
  assert.equal((await req('POST', '/api/agentes', { token: admin, body: { nombre: 'X', correo: 'ana@pruebas.com', password: 'Clave123' } })).status, 409);

  ana = (await login('ana@pruebas.com')).data.access_token;
  beto = (await login('beto@pruebas.com')).data.access_token;
  r = await req('POST', '/api/agentes', { token: ana, body: { nombre: 'X', correo: 'x@pruebas.com', password: 'Clave123' } });
  assert.equal(r.status, 403, 'un Agente no puede crear agentes');
  assert.equal((await req('GET', '/api/auth/perfil', { token: ana })).data.correo, 'ana@pruebas.com');
});

// ---------------------------------------------------------------------------
let t1;

test('crear ticket: asigna el SLA según la prioridad', async () => {
  const r = await req('POST', '/api/tickets', {
    token: admin,
    body: { titulo: 'Servidor caído', descripcion: 'No responde', prioridad: 'critica', agente_id: anaId }
  });
  assert.equal(r.status, 201);
  t1 = r.data.ticket;
  assert.equal(t1.prioridad, 'Crítica');
  assert.equal(t1.tiempo_limite_resolucion, 30);
  assert.equal(t1.estado_sla, 'en_tiempo');
  assert.equal(t1.agente_nombre, 'Ana');

  const malo = await req('POST', '/api/tickets', { token: admin, body: { titulo: 'x', descripcion: 'y', prioridad: 'Alta', agente_id: 999 } });
  assert.equal(malo.status, 400);
  assert.equal(malo.data.error, 'El agente indicado no existe.');
});

test('pausa, reanuda y congela el reloj del SLA', async () => {
  await pool.query(`UPDATE tickets SET fecha_creacion = LOCALTIMESTAMP - interval '10 min' WHERE id = $1`, [t1.id]);
  let r = await req('PUT', `/api/tickets/${t1.id}`, { token: ana, body: { estado: 'En Espera' } });
  assert.equal(r.data.ticket.en_espera, true);

  // Simula 4 minutos en pausa
  await pool.query(
    `UPDATE tickets SET fecha_creacion = fecha_creacion - interval '4 min', pausado_desde = pausado_desde - interval '4 min' WHERE id = $1`,
    [t1.id]
  );
  r = await req('PUT', `/api/tickets/${t1.id}`, { token: ana, body: { estado: 'En Progreso', en_espera: true } });
  assert.equal(r.data.ticket.en_espera, false, 'si envían estado y en_espera, manda estado');
  assert.equal(r.data.ticket.minutos_pausados, 4);
  assert.equal(r.data.ticket.tiempo_transcurrido_minutos, 10, 'el tiempo en pausa no cuenta');
  assert.equal(r.data.ticket.minutos_restantes, 20);

  r = await req('PUT', `/api/tickets/${t1.id}`, { token: ana, body: { estado: 'Resuelto' } });
  const congelado = r.data.ticket.tiempo_transcurrido_minutos;
  await pool.query(
    `UPDATE tickets SET fecha_creacion = fecha_creacion - interval '60 min', fecha_resolucion = fecha_resolucion - interval '60 min' WHERE id = $1`,
    [t1.id]
  );
  r = await req('GET', `/api/tickets/${t1.id}`, { token: ana });
  assert.equal(r.data.tiempo_transcurrido_minutos, congelado, 'resuelto: el reloj queda congelado');
});

test('propiedad del recurso: un Agente no gestiona tickets de otro', async () => {
  const deAna = (await req('POST', '/api/tickets', {
    token: admin, body: { titulo: 'De Ana', descripcion: 'x', prioridad: 'Alta', agente_id: anaId }
  })).data.ticket;
  const sinAsignar = (await req('POST', '/api/tickets', {
    token: admin, body: { titulo: 'Libre', descripcion: 'x', prioridad: 'Baja' }
  })).data.ticket;

  let r = await req('PUT', `/api/tickets/${deAna.id}`, { token: beto, body: { estado: 'Resuelto' } });
  assert.equal(r.status, 403, 'Beto no puede resolver el ticket de Ana');
  r = await req('GET', `/api/tickets/${deAna.id}`, { token: beto });
  assert.equal(r.data.estado, 'Abierto', 'y el ticket no cambió');

  assert.equal((await req('PUT', `/api/tickets/${sinAsignar.id}`, { token: beto, body: { estado: 'En Progreso' } })).status, 200, 'sí puede uno sin asignar');
  assert.equal((await req('PUT', `/api/tickets/${deAna.id}`, { token: ana, body: { estado: 'En Progreso' } })).status, 200, 'Ana sí puede el suyo');
  assert.equal((await req('PUT', `/api/tickets/${deAna.id}`, { token: admin, body: { estado: 'Abierto' } })).status, 200, 'el Administrador puede cualquiera');
});

test('dos cambios simultáneos al mismo ticket no se pisan', async () => {
  const t = (await req('POST', '/api/tickets', { token: admin, body: { titulo: 'Concurrencia', descripcion: 'x', prioridad: 'Media' } })).data.ticket;
  await pool.query(`UPDATE tickets SET fecha_creacion = LOCALTIMESTAMP - interval '30 min' WHERE id = $1`, [t.id]);
  await req('PUT', `/api/tickets/${t.id}`, { token: admin, body: { estado: 'En Espera' } });
  await pool.query(`UPDATE tickets SET pausado_desde = pausado_desde - interval '5 min' WHERE id = $1`, [t.id]);

  // Dos reanudaciones a la vez: solo una debe sumar los 5 minutos de pausa
  await Promise.all([
    req('PUT', `/api/tickets/${t.id}`, { token: admin, body: { estado: 'En Progreso' } }),
    req('PUT', `/api/tickets/${t.id}`, { token: admin, body: { estado: 'En Progreso' } })
  ]);
  const { rows } = await pool.query('SELECT minutos_pausados FROM tickets WHERE id = $1', [t.id]);
  assert.equal(rows[0].minutos_pausados, 5);
});

test('monitor del SLA: avisa el cambio de color y escala una sola vez', async () => {
  const t = (await req('POST', '/api/tickets', { token: admin, body: { titulo: 'Impresora', descripcion: 'x', prioridad: 'Alta' } })).data.ticket;
  recibidos.length = 0;

  await pool.query(`UPDATE tickets SET fecha_creacion = LOCALTIMESTAMP - interval '100 min' WHERE id = $1`, [t.id]);
  await sleep(2500);
  assert.ok(
    recibidos.some(([e, d]) => e === EVENTOS.SLA_CAMBIO && d.ticket.id === t.id && d.ticket.estado_sla === 'por_vencer'),
    'avisó verde -> amarillo'
  );

  await pool.query(`UPDATE tickets SET fecha_creacion = LOCALTIMESTAMP - interval '130 min' WHERE id = $1`, [t.id]);
  await sleep(3500);
  const escalados = recibidos.filter(([e, d]) => e === EVENTOS.TICKET_ESCALADO && d.ticket.id === t.id);
  assert.equal(escalados.length, 1, 'escaló una sola vez');
  assert.match(escalados[0][1].registro.motivo, /SLA vencido: prioridad Alta/);

  const r = await req('GET', `/api/tickets/${t.id}/historial`, { token: admin });
  assert.equal(r.data.length, 1);
});

test('borrar tickets: solo el Administrador', async () => {
  const t = (await req('POST', '/api/tickets', { token: admin, body: { titulo: 'Borrar', descripcion: 'x', prioridad: 'Baja' } })).data.ticket;
  assert.equal((await req('DELETE', `/api/tickets/${t.id}`, { token: ana })).status, 403);
  assert.equal((await req('DELETE', '/api/tickets', { token: ana })).status, 403);
  assert.equal((await req('DELETE', `/api/tickets/${t.id}`, { token: admin })).status, 200);
  assert.equal((await req('GET', `/api/tickets/${t.id}`, { token: admin })).status, 404);

  assert.equal((await req('DELETE', '/api/tickets', { token: admin })).status, 200);
  assert.equal((await req('GET', '/api/tickets', { token: admin })).data.length, 0);
  assert.equal((await req('GET', '/api/agentes', { token: admin })).data.length, 3, 'los agentes no se borran');
});
