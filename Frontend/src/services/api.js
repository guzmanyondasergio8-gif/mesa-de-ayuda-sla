// Todas las llamadas al Backend pasan por este archivo.
//
// USAR_MOCK = true  -> usa los datos de prueba de src/data/mock (no necesita backend ni base de datos)
// USAR_MOCK = false -> usa la API real (necesita el backend corriendo con PostgreSQL)
//
// Las funciones devuelven exactamente lo mismo en los dos modos,
// así que las vistas no cambian al pasar de uno a otro.
// Si algo falla, lanzan un Error cuyo .message es el mensaje que devuelve la API.

import ticketsMock from '@/data/mock/tickets.json'
import agentesMock from '@/data/mock/agentes.json'
import catalogosMock from '@/data/mock/catalogos.json'

const USAR_MOCK = false
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

// ---------------------------------------------------------------------------
// Modo API real
// ---------------------------------------------------------------------------
async function peticion(ruta, opciones = {}) {
  const res = await fetch(`${API_URL}${ruta}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status} en la petición`)
  }
  return data
}

// ---------------------------------------------------------------------------
// Modo mock (simula el backend en memoria; se reinicia al recargar la página)
// ---------------------------------------------------------------------------
let ticketsMemoria = structuredClone(ticketsMock)
const copia = (dato) => structuredClone(dato)
const esperar = (ms = 300) => new Promise((r) => setTimeout(r, ms)) // simula la demora de red

function minutosSla(prioridad) {
  return catalogosMock.prioridades.find((p) => p.nombre === prioridad)?.minutos_sla
}

function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

// ---------------------------------------------------------------------------
// Funciones que usan las vistas
// ---------------------------------------------------------------------------

// Lista de tickets (cada uno trae estado_sla y minutos_restantes ya calculados)
export async function obtenerTickets() {
  if (!USAR_MOCK) return peticion('/tickets')
  await esperar()
  return copia(ticketsMemoria)
}

// Un ticket por id
export async function obtenerTicket(id) {
  if (!USAR_MOCK) return peticion(`/tickets/${id}`)
  await esperar()
  const ticket = ticketsMemoria.find((t) => t.id === Number(id))
  if (!ticket) throw new Error('Ticket no encontrado')
  return copia(ticket)
}

// Crear ticket. datos = { titulo, descripcion, prioridad, agente_id }
// Devuelve { mensaje, ticket }
export async function crearTicket(datos) {
  if (!USAR_MOCK) {
    return peticion('/tickets', { method: 'POST', body: JSON.stringify(datos) })
  }
  await esperar()

  const { titulo, descripcion, prioridad, agente_id } = datos
  if (!titulo || !descripcion || !prioridad) {
    throw new Error('Título, descripción y prioridad son obligatorios.')
  }
  const prioridadValida = catalogosMock.prioridades.find(
    (p) => normalizar(p.nombre) === normalizar(prioridad)
  )?.nombre
  if (!prioridadValida) {
    throw new Error('Prioridad no válida. Valores permitidos: Baja, Media, Alta, Crítica.')
  }
  if (agente_id && !agentesMock.some((a) => a.id === Number(agente_id))) {
    throw new Error('El agente indicado no existe.')
  }

  const ahora = new Date().toISOString()
  const limite = minutosSla(prioridadValida)
  const ticket = {
    id: Math.max(0, ...ticketsMemoria.map((t) => t.id)) + 1,
    titulo,
    descripcion,
    prioridad: prioridadValida,
    estado: 'Abierto',
    agente_id: agente_id ? Number(agente_id) : null,
    tiempo_limite_resolucion: limite,
    tiempo_transcurrido_minutos: 0,
    minutos_restantes: limite,
    estado_sla: 'en_tiempo',
    en_espera: false,
    pausado_desde: null,
    minutos_pausados: 0,
    fecha_resolucion: null,
    fecha_creacion: ahora,
    fecha_actualizacion: ahora
  }
  ticketsMemoria.unshift(ticket)
  return { mensaje: 'Ticket creado con éxito', ticket: copia(ticket) }
}

// Cambiar estado: "En Espera" pausa, "En Progreso"/"Abierto" reanuda, "Resuelto"/"Cerrado" finaliza
// Devuelve { mensaje, ticket }
export async function actualizarEstado(id, estado) {
  if (!USAR_MOCK) {
    return peticion(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify({ estado }) })
  }
  await esperar()

  const estadoValido = catalogosMock.estados.find((e) => normalizar(e) === normalizar(estado))
  if (!estadoValido) {
    throw new Error(`Estado no válido. Valores permitidos: ${catalogosMock.estados.join(', ')}.`)
  }
  const ticket = ticketsMemoria.find((t) => t.id === Number(id))
  if (!ticket) throw new Error('Ticket no encontrado')

  const ahora = new Date().toISOString()
  const esFinal = ['Resuelto', 'Cerrado'].includes(estadoValido)
  ticket.estado = estadoValido
  ticket.en_espera = !esFinal && estadoValido === 'En Espera'
  ticket.pausado_desde = ticket.en_espera ? (ticket.pausado_desde || ahora) : null
  ticket.fecha_resolucion = esFinal ? (ticket.fecha_resolucion || ahora) : null
  ticket.fecha_actualizacion = ahora
  return { mensaje: 'Estado del ticket actualizado', ticket: copia(ticket) }
}

// Lista de agentes [{ id, nombre, correo, rol }]
export async function obtenerAgentes() {
  if (!USAR_MOCK) return peticion('/agentes')
  await esperar()
  return copia(agentesMock)
}

// Catálogos { prioridades: [{ nombre, minutos_sla }], estados: [...], estados_sla: [...] }
export async function obtenerCatalogos() {
  if (!USAR_MOCK) return peticion('/catalogos')
  await esperar()
  return copia(catalogosMock)
}
