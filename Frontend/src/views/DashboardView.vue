<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <div>
        <h1>Dashboard de SLAs</h1>
        <p>Gestión y monitoreo de tickets de soporte en tiempo real</p>
      </div>
      <div class="header-acciones">
        <button
          v-if="auth.esAdmin && tickets.length > 0"
          type="button"
          class="btn-peligro-borde"
          @click="confirmarLimpiar = true"
        >
          Limpiar tablero
        </button>
        <router-link to="/tickets/nuevo" class="btn-primario">+ Nuevo ticket</router-link>
      </div>
    </header>

    <p v-if="error" class="mensaje-error">{{ error }}</p>

    <!-- Métricas: también funcionan como filtros -->
    <div class="metrics-summary" role="group" aria-label="Filtrar tickets">
      <button
        v-for="m in metricas"
        :key="m.valor"
        type="button"
        class="metric-card"
        :class="[m.clase, { activo: filtro === m.valor }]"
        :aria-pressed="filtro === m.valor"
        @click="filtro = filtro === m.valor && m.valor !== 'todos' ? 'todos' : m.valor"
      >
        <span class="metric-value">{{ m.cantidad }}</span>
        <span class="metric-label">{{ m.etiqueta }}</span>
      </button>
    </div>

    <p v-if="filtro !== 'todos'" class="filtro-activo">
      Mostrando: <strong>{{ etiquetaFiltro }}</strong>
      <button type="button" class="enlace" @click="filtro = 'todos'">Ver todos</button>
    </p>

    <p v-if="cargando" class="mensaje-vacio">Cargando...</p>
    <div v-else-if="tickets.length === 0" class="estado-vacio">
      <p class="vacio-titulo">No hay tickets todavía</p>
      <p>Cuando alguien reporte un problema, aparecerá aquí con su semáforo de SLA.</p>
      <router-link to="/tickets/nuevo" class="btn-primario">Crear el primer ticket</router-link>
    </div>
    <p v-else-if="ticketsVisibles.length === 0" class="mensaje-vacio">No hay tickets en este filtro.</p>

    <TransitionGroup name="lista" tag="div" class="tickets-grid">
      <article
        v-for="ticket in ticketsVisibles"
        :key="ticket.id"
        class="ticket-card"
        :class="esFinalizado(ticket) ? 'finalizado' : ticket.estado_sla"
      >
        <div class="ticket-header">
          <span class="ticket-id">
            #{{ ticket.id }}
            <span class="prioridad" :class="'prioridad-' + claseTexto(ticket.prioridad)">{{ ticket.prioridad }}</span>
          </span>
          <span class="etiquetas">
            <span
              v-if="ticket.escalado"
              class="etiqueta-escalado"
              title="Venció y quedó registrado en el historial de escalados"
            >
              Escalado
            </span>
            <span class="ticket-badge" :class="esFinalizado(ticket) ? 'finalizado' : ticket.estado_sla">
              {{ esFinalizado(ticket) ? ticket.estado : textoSla(ticket.estado_sla) }}
            </span>
          </span>
        </div>

        <h3 class="ticket-title">{{ ticket.titulo }}</h3>
        <p class="ticket-description">{{ ticket.descripcion }}</p>

        <!-- Tiempo y barra de progreso del SLA -->
        <div class="sla">
          <p class="ticket-tiempo">
            <svg class="icono" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
              <path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <span>{{ esFinalizado(ticket) ? textoFinalizado(ticket) : textoTiempo(ticket.minutos_restantes) }}</span>
            <span v-if="ticket.en_espera" class="etiqueta-pausa">En pausa</span>
          </p>
          <div
            class="barra"
            role="progressbar"
            :aria-valuenow="porcentaje(ticket)"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`SLA consumido: ${porcentaje(ticket)} %`"
          >
            <div class="barra-relleno" :style="{ width: Math.min(porcentaje(ticket), 100) + '%' }"></div>
          </div>
          <p class="barra-texto">
            {{ ticket.tiempo_transcurrido_minutos }} de {{ ticket.tiempo_limite_resolucion }} min ·
            {{ porcentaje(ticket) }} % del SLA
          </p>
        </div>

        <dl class="ticket-meta">
          <div><dt>Asignado</dt><dd>{{ ticket.agente_nombre || 'Sin asignar' }}</dd></div>
          <div><dt>Estado</dt><dd>{{ ticket.estado }}</dd></div>
          <div><dt>Creado</dt><dd>{{ haceCuanto(ticket.minutos_desde_creacion) }}</dd></div>
        </dl>

        <!-- Confirmación de borrado dentro de la tarjeta -->
        <div v-if="confirmarBorrar === ticket.id" class="confirmacion">
          <span>¿Eliminar este ticket? No se puede deshacer.</span>
          <div class="confirmacion-botones">
            <button type="button" @click="confirmarBorrar = null">Cancelar</button>
            <button type="button" class="btn-peligro" :disabled="borrando" @click="borrar(ticket.id)">
              {{ borrando ? 'Eliminando...' : 'Eliminar' }}
            </button>
          </div>
        </div>

        <div v-else class="ticket-actions">
          <template v-if="!esFinalizado(ticket) && puedeGestionar(ticket)">
            <button v-if="!ticket.en_espera" type="button" @click="cambiarEstado(ticket.id, 'En Espera')">
              Pausar
            </button>
            <button v-else type="button" @click="cambiarEstado(ticket.id, 'En Progreso')">
              Reanudar
            </button>
            <button type="button" class="btn-resolver" @click="cambiarEstado(ticket.id, 'Resuelto')">
              Resolver
            </button>
          </template>
          <span v-else-if="!esFinalizado(ticket)" class="solo-lectura">
            Lo gestiona {{ ticket.agente_nombre }}
          </span>
          <button
            v-if="auth.esAdmin"
            type="button"
            class="btn-icono"
            title="Eliminar ticket"
            aria-label="Eliminar ticket"
            @click="confirmarBorrar = ticket.id"
          >
            <svg class="icono" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </article>
    </TransitionGroup>

    <!-- Confirmación para limpiar todo el tablero -->
    <div v-if="confirmarLimpiar" class="modal-fondo" @click.self="confirmarLimpiar = false">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-limpiar">
        <h2 id="titulo-limpiar">¿Limpiar el tablero?</h2>
        <p>
          Se eliminarán los <strong>{{ tickets.length }} tickets</strong> y su historial de escalados.
          Los agentes no se borran. Esta acción no se puede deshacer.
        </p>
        <div class="modal-botones">
          <button type="button" @click="confirmarLimpiar = false">Cancelar</button>
          <button type="button" class="btn-peligro" :disabled="borrando" @click="limpiarTodo">
            {{ borrando ? 'Eliminando...' : 'Eliminar todos' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  obtenerTickets,
  actualizarEstado,
  eliminarTicket,
  eliminarTodosLosTickets
} from '@/services/api'
import { escuchar, EVENTOS } from '@/services/tiempoReal'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()
const tickets = ref([])
const cargando = ref(true)
const error = ref('')
const filtro = ref('todos')
const confirmarBorrar = ref(null)
const confirmarLimpiar = ref(false)
const borrando = ref(false)
let intervalo = null
let dejarDeEscuchar = []

// ---------------------------------------------------------------------------
// Datos y tiempo real
// ---------------------------------------------------------------------------

// Momento en que cada ticket se actualizó por un evento en vivo (id -> ms)
const actualizadoEnVivo = new Map()

async function cargarTickets() {
  const inicio = Date.now()
  try {
    const recibidos = await obtenerTickets()
    // Si un evento en vivo llegó mientras se esperaba esta respuesta, esa versión
    // es más reciente: no se pisa con la que trajo la recarga
    tickets.value = recibidos.map((t) => {
      if ((actualizadoEnVivo.get(t.id) || 0) > inicio) {
        return tickets.value.find((x) => x.id === t.id) || t
      }
      return t
    })
    error.value = ''
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

// Reemplaza el ticket en la lista (o lo agrega si es nuevo)
function actualizarEnLista(ticket) {
  actualizadoEnVivo.set(ticket.id, Date.now())
  const i = tickets.value.findIndex((t) => t.id === ticket.id)
  if (i === -1) tickets.value.unshift(ticket)
  else tickets.value[i] = ticket
}

function quitarDeLista(id) {
  actualizadoEnVivo.set(id, Date.now())
  tickets.value = tickets.value.filter((t) => t.id !== id)
  if (confirmarBorrar.value === id) confirmarBorrar.value = null
}

onMounted(() => {
  cargarTickets()

  // El backend avisa cada cambio y la tarjeta se actualiza al instante
  dejarDeEscuchar = [
    escuchar(EVENTOS.TICKET_CREADO, actualizarEnLista),
    escuchar(EVENTOS.TICKET_ACTUALIZADO, actualizarEnLista),
    escuchar(EVENTOS.SLA_CAMBIO, ({ ticket }) => actualizarEnLista(ticket)),
    escuchar(EVENTOS.TICKET_ESCALADO, ({ ticket }) => actualizarEnLista(ticket)),
    escuchar(EVENTOS.TICKET_ELIMINADO, ({ id }) => quitarDeLista(id)),
    escuchar(EVENTOS.TICKETS_LIMPIADOS, () => {
      tickets.value = []
      confirmarBorrar.value = null
    })
  ]

  // Cada minuto se recargan los minutos restantes de todos los tickets
  intervalo = setInterval(cargarTickets, 60000)
})

onUnmounted(() => {
  clearInterval(intervalo)
  dejarDeEscuchar.forEach((dejar) => dejar())
})

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------
async function cambiarEstado(id, estado) {
  try {
    const { ticket } = await actualizarEstado(id, estado)
    actualizarEnLista(ticket)
    error.value = ''
  } catch (e) {
    error.value = e.message
  }
}

async function borrar(id) {
  borrando.value = true
  try {
    await eliminarTicket(id)
    quitarDeLista(id)
    error.value = ''
  } catch (e) {
    error.value = e.message
  } finally {
    borrando.value = false
  }
}

async function limpiarTodo() {
  borrando.value = true
  try {
    await eliminarTodosLosTickets()
    tickets.value = []
    filtro.value = 'todos'
    error.value = ''
  } catch (e) {
    error.value = e.message
  } finally {
    borrando.value = false
    confirmarLimpiar.value = false
  }
}

// ---------------------------------------------------------------------------
// Orden, filtros y métricas
// ---------------------------------------------------------------------------
const esFinalizado = (t) => t.estado === 'Resuelto' || t.estado === 'Cerrado'

// Misma regla que el backend: un Agente solo gestiona sus tickets o los sin asignar
const puedeGestionar = (t) => auth.esAdmin || !t.agente_id || t.agente_id === auth.agente?.id
const activos = computed(() => tickets.value.filter((t) => !esFinalizado(t)))
const contar = (estadoSla) => activos.value.filter((t) => t.estado_sla === estadoSla).length

const metricas = computed(() => [
  { valor: 'todos', etiqueta: 'Total de tickets', cantidad: tickets.value.length, clase: 'metric-total' },
  { valor: 'vencido', etiqueta: 'Vencidos', cantidad: contar('vencido'), clase: 'metric-danger' },
  { valor: 'por_vencer', etiqueta: 'Por vencer', cantidad: contar('por_vencer'), clase: 'metric-warning' },
  { valor: 'en_tiempo', etiqueta: 'En tiempo', cantidad: contar('en_tiempo'), clase: 'metric-success' },
  { valor: 'finalizados', etiqueta: 'Resueltos', cantidad: tickets.value.length - activos.value.length, clase: 'metric-done' }
])

const etiquetaFiltro = computed(() => metricas.value.find((m) => m.valor === filtro.value)?.etiqueta)

// Más urgente primero: vencidos, por vencer, en tiempo (menos minutos arriba); resueltos al final
const PESO = { vencido: 0, por_vencer: 1, en_tiempo: 2 }
function urgencia(a, b) {
  const fa = esFinalizado(a)
  const fb = esFinalizado(b)
  if (fa !== fb) return fa ? 1 : -1
  if (fa) return b.id - a.id
  return PESO[a.estado_sla] - PESO[b.estado_sla] || a.minutos_restantes - b.minutos_restantes
}

const ticketsVisibles = computed(() => {
  let lista = tickets.value
  if (filtro.value === 'finalizados') lista = lista.filter(esFinalizado)
  else if (filtro.value !== 'todos') {
    lista = lista.filter((t) => !esFinalizado(t) && t.estado_sla === filtro.value)
  }
  return [...lista].sort(urgencia)
})

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------
function textoSla(estado) {
  if (estado === 'vencido') return 'Vencido'
  if (estado === 'por_vencer') return 'Por vencer'
  return 'En tiempo'
}

function duracion(minutos) {
  const abs = Math.abs(minutos)
  const d = Math.floor(abs / 1440)
  const h = Math.floor((abs % 1440) / 60)
  const m = abs % 60
  if (d > 0) return `${d} d ${h} h`
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

function textoTiempo(minutos) {
  return minutos < 0 ? `Vencido hace ${duracion(minutos)}` : `Quedan ${duracion(minutos)}`
}

function textoFinalizado(ticket) {
  return ticket.minutos_restantes < 0
    ? `Resuelto ${duracion(ticket.minutos_restantes)} tarde`
    : `Resuelto con ${duracion(ticket.minutos_restantes)} de margen`
}

function haceCuanto(minutos) {
  if (minutos === undefined || minutos === null) return '—'
  if (minutos < 1) return 'hace un momento'
  return `hace ${duracion(minutos)}`
}

function porcentaje(ticket) {
  if (!ticket.tiempo_limite_resolucion) return 0
  return Math.round((ticket.tiempo_transcurrido_minutos / ticket.tiempo_limite_resolucion) * 100)
}

const claseTexto = (texto) =>
  String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
</script>

<style scoped>
.dashboard-container {
  padding: 2rem;
  max-width: 1240px;
  margin: 0 auto;
  font-family: system-ui, -apple-system, sans-serif;
  color: #334155;
}

/* ---------- Encabezado ---------- */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.75rem;
}

.dashboard-header h1 {
  margin: 0;
  font-size: 1.85rem;
  color: #0f172a;
}

.dashboard-header p {
  color: #64748b;
  margin: 0.25rem 0 0;
}

.header-acciones {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.btn-primario {
  display: inline-block;
  padding: 0.6rem 1.1rem;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  font-weight: 600;
  text-decoration: none;
  font-size: 0.95rem;
}

.btn-primario:hover {
  background: #1d4ed8;
}

.btn-peligro-borde {
  padding: 0.55rem 1rem;
  border-radius: 8px;
  border: 1px solid #fca5a5;
  background: #fff;
  color: #b91c1c;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-peligro-borde:hover {
  background: #fef2f2;
}

.mensaje-error {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 0.6rem 0.9rem;
}

.mensaje-vacio {
  color: #64748b;
}

/* ---------- Métricas / filtros ---------- */
.metrics-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.metric-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-left-width: 4px;
  border-radius: 10px;
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.metric-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
}

.metric-card.activo {
  box-shadow: 0 0 0 2px #2563eb;
}

.metric-value {
  font-size: 1.9rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.1;
}

.metric-label {
  font-size: 0.85rem;
  color: #64748b;
  margin-top: 0.3rem;
}

.metric-total { border-left-color: #2563eb; }
.metric-danger { border-left-color: #ef4444; }
.metric-warning { border-left-color: #f59e0b; }
.metric-success { border-left-color: #10b981; }
.metric-done { border-left-color: #94a3b8; }

.filtro-activo {
  font-size: 0.9rem;
  color: #475569;
  margin: 0 0 1rem;
}

.enlace {
  border: none;
  background: none;
  color: #2563eb;
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
  margin-left: 0.4rem;
}

/* ---------- Estado vacío ---------- */
.estado-vacio {
  text-align: center;
  padding: 3rem 1rem;
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  color: #64748b;
  margin-top: 1rem;
}

.vacio-titulo {
  font-size: 1.15rem;
  font-weight: 700;
  color: #334155;
  margin: 0 0 0.25rem;
}

.estado-vacio .btn-primario {
  margin-top: 1rem;
}

/* ---------- Tarjetas ---------- */
.tickets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
  margin-top: 1rem;
}

.ticket-card {
  --color: #10b981;
  --fondo: #ecfdf5;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-top: 4px solid var(--color);
  border-radius: 12px;
  padding: 1.15rem 1.25rem;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.4s ease;
}

.ticket-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
}

.ticket-card.por_vencer { --color: #f59e0b; --fondo: #fffbeb; }
.ticket-card.vencido { --color: #ef4444; --fondo: #fef2f2; }
.ticket-card.finalizado { --color: #94a3b8; --fondo: #f1f5f9; opacity: 0.75; }

.ticket-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.ticket-id {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  color: #64748b;
  font-size: 0.85rem;
}

.prioridad {
  padding: 0.1rem 0.5rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  background: #f1f5f9;
  color: #475569;
}

.prioridad-critica { background: #fee2e2; color: #991b1b; }
.prioridad-alta { background: #ffedd5; color: #9a3412; }
.prioridad-media { background: #e0f2fe; color: #075985; }

.etiquetas {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
}

.ticket-badge {
  padding: 0.22rem 0.65rem;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  background: var(--fondo, #ecfdf5);
  color: #065f46;
}

.ticket-badge.por_vencer { background: #fef3c7; color: #92400e; }
.ticket-badge.vencido { background: #fee2e2; color: #991b1b; }
.ticket-badge.finalizado { background: #e2e8f0; color: #334155; }

.etiqueta-escalado {
  padding: 0.22rem 0.6rem;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  background: #7f1d1d;
  color: #fff;
}

.ticket-title {
  margin: 0 0 0.3rem;
  font-size: 1.1rem;
  color: #0f172a;
}

.ticket-description {
  margin: 0 0 0.9rem;
  color: #64748b;
  font-size: 0.92rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ---------- Tiempo y barra de SLA ---------- */
.sla {
  background: var(--fondo);
  border-radius: 8px;
  padding: 0.7rem 0.8rem;
  margin-bottom: 0.9rem;
  transition: background 0.4s ease;
}

.ticket-tiempo {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.5rem;
  font-weight: 700;
  color: #0f172a;
  font-size: 0.95rem;
}

.icono {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.ticket-tiempo .icono {
  color: var(--color);
}

.etiqueta-pausa {
  margin-left: auto;
  padding: 0.12rem 0.5rem;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  background: #e0e7ff;
  color: #3730a3;
}

.barra {
  height: 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.barra-relleno {
  height: 100%;
  border-radius: 999px;
  background: var(--color);
  transition: width 0.6s ease, background 0.4s ease;
}

.barra-texto {
  margin: 0.35rem 0 0;
  font-size: 0.78rem;
  color: #64748b;
}

/* ---------- Datos ---------- */
.ticket-meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin: 0 0 1rem;
  padding-top: 0.8rem;
  border-top: 1px solid #f1f5f9;
}

.ticket-meta dt {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #94a3b8;
}

.ticket-meta dd {
  margin: 0.1rem 0 0;
  font-size: 0.85rem;
  color: #334155;
  font-weight: 600;
}

/* ---------- Acciones ---------- */
.ticket-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
}

.ticket-actions button,
.confirmacion button,
.modal-botones button {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #fff;
  color: #334155;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.ticket-actions button:hover {
  background: #f8fafc;
}

.ticket-actions .btn-resolver {
  border-color: #6ee7b7;
  color: #047857;
}

.ticket-actions .btn-resolver:hover {
  background: #ecfdf5;
}

.ticket-actions .btn-icono {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.65rem;
  margin-left: auto;
  color: #94a3b8;
}

.ticket-actions .btn-icono:hover {
  color: #b91c1c;
  border-color: #fca5a5;
  background: #fef2f2;
}

.solo-lectura {
  align-self: center;
  font-size: 0.82rem;
  color: #94a3b8;
  font-style: italic;
}

.confirmacion {
  margin-top: auto;
  padding: 0.7rem;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  font-size: 0.85rem;
  color: #991b1b;
}

.confirmacion-botones,
.modal-botones {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

button.btn-peligro {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

button.btn-peligro:hover {
  background: #b91c1c;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ---------- Modal ---------- */
.modal-fondo {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 40;
}

.modal {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
}

.modal h2 {
  margin: 0 0 0.5rem;
  font-size: 1.2rem;
  color: #0f172a;
}

.modal p {
  margin: 0;
  color: #475569;
  line-height: 1.5;
}

.modal-botones {
  margin-top: 1.25rem;
}

/* ---------- Animación al entrar, salir y reordenar ---------- */
.lista-move,
.lista-enter-active,
.lista-leave-active {
  transition: all 0.35s ease;
}

.lista-enter-from,
.lista-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

@media (max-width: 640px) {
  .dashboard-container {
    padding: 1.25rem 1rem;
  }

  .ticket-meta {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
