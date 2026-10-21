<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h1>Dashboard de SLAs</h1>
      <p>Gestión y monitoreo de tickets de soporte</p>
    </header>

    <p v-if="cargando" class="mensaje-cargando">Cargando...</p>
    <p v-if="error" class="mensaje-error">{{ error }}</p>

    <div class="metrics-summary">
      <div class="metric-card">
        <span class="metric-value">{{ tickets.length }}</span>
        <span class="metric-label">Total Tickets</span>
      </div>
      <div class="metric-card metric-danger">
        <span class="metric-value">{{ countBySla('vencido') }}</span>
        <span class="metric-label">Vencidos (Rojo)</span>
      </div>
      <div class="metric-card metric-warning">
        <span class="metric-value">{{ countBySla('por_vencer') }}</span>
        <span class="metric-label">Por Vencer (Amarillo)</span>
      </div>
      <div class="metric-card metric-success">
        <span class="metric-value">{{ countBySla('en_tiempo') }}</span>
        <span class="metric-label">En Tiempo (Verde)</span>
      </div>
    </div>

    <div class="tickets-grid">
      <div
        v-for="ticket in tickets"
        :key="ticket.id"
        class="ticket-card"
        :class="[getSlaClass(ticket), { finalizado: esFinalizado(ticket) }]"
      >
        <div class="ticket-header">
          <span class="ticket-id">#{{ ticket.id }}</span>
          <span class="ticket-badge" :class="getSlaClass(ticket)">
            {{ getSlaText(ticket) }}
          </span>
        </div>

        <h3 class="ticket-title">{{ ticket.titulo || ticket.asunto }}</h3>
        <p class="ticket-description">{{ ticket.descripcion }}</p>

        <p class="ticket-tiempo">
          {{ textoTiempo(ticket.minutos_restantes) }}
          <span v-if="ticket.en_espera" class="etiqueta-pausa">En pausa</span>
        </p>

        <div class="ticket-meta">
          <span class="meta-item">
            <strong>Categoría:</strong> {{ ticket.categoria || 'Soporte' }}
          </span>
          <span class="meta-item">
            <strong>Prioridad:</strong> {{ ticket.prioridad || 'Media' }}
          </span>
          <span class="meta-item">
            <strong>Estado:</strong> {{ ticket.estado }}
          </span>
        </div>

        <div v-if="!esFinalizado(ticket)" class="ticket-actions">
          <button
            v-if="!ticket.en_espera"
            @click="cambiarEstado(ticket.id, 'En Espera')"
          >
            Pausar
          </button>
          <button
            v-else
            @click="cambiarEstado(ticket.id, 'En Progreso')"
          >
            Reanudar
          </button>
          <button
            class="btn-resolver"
            @click="cambiarEstado(ticket.id, 'Resuelto')"
          >
            Resolver
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { obtenerTickets, actualizarEstado } from '@/services/api'

const tickets = ref([])
const cargando = ref(true)
const error = ref('')
let intervalo = null

async function cargarTickets() {
  try {
    tickets.value = await obtenerTickets()
    error.value = ''
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

onMounted(() => {
  cargarTickets()
  intervalo = setInterval(cargarTickets, 30000)
})

onUnmounted(() => clearInterval(intervalo))

async function cambiarEstado(id, estado) {
  try {
    await actualizarEstado(id, estado)
    await cargarTickets()
  } catch (e) {
    error.value = e.message
  }
}

function getSlaState(ticket) {
  return ticket.estado_sla
}

function getSlaClass(ticket) {
  const state = getSlaState(ticket)
  return {
    'vencido': state === 'vencido',
    'por_vencer': state === 'por_vencer',
    'en_tiempo': state === 'en_tiempo'
  }
}

function getSlaText(ticket) {
  const state = getSlaState(ticket)
  if (state === 'vencido') return 'Vencido'
  if (state === 'por_vencer') return 'Por Vencer'
  return 'En Tiempo'
}

function countBySla(state) {
  return tickets.value.filter(t => getSlaState(t) === state).length
}

function textoTiempo(minutos) {
  const abs = Math.abs(minutos)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const texto = h > 0 ? `${h}h ${m}min` : `${m}min`
  return minutos < 0 ? `Vencido hace ${texto}` : `Quedan ${texto}`
}

function esFinalizado(ticket) {
  return ['Resuelto', 'Cerrado'].includes(ticket.estado)
}
</script>

<style scoped>
.dashboard-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  font-family: system-ui, -apple-system, sans-serif;
  color: #333;
}

.dashboard-header {
  margin-bottom: 2rem;
}

.dashboard-header h1 {
  margin: 0;
  font-size: 2rem;
  color: #1e293b;
}

.dashboard-header p {
  color: #64748b;
  margin-top: 0.25rem;
}

.mensaje-cargando {
  color: #64748b;
  margin-bottom: 1rem;
}

.mensaje-error {
  color: #dc2626;
  margin-bottom: 1rem;
}

.metrics-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.metric-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
}

.metric-value {
  font-size: 2rem;
  font-weight: bold;
  color: #0f172a;
}

.metric-label {
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 0.25rem;
}

.metric-danger { border-left: 4px solid #ef4444; }
.metric-warning { border-left: 4px solid #f59e0b; }
.metric-success { border-left: 4px solid #10b981; }

.tickets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.ticket-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.ticket-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.ticket-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.ticket-id {
  font-weight: 700;
  color: #64748b;
  font-size: 0.875rem;
}

.ticket-badge {
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.vencido { background-color: #fee2e2; color: #991b1b; }
.por_vencer { background-color: #fef3c7; color: #92400e; }
.en_tiempo { background-color: #d1fae5; color: #065f46; }

.ticket-card.vencido { border-top: 4px solid #ef4444; }
.ticket-card.por_vencer { border-top: 4px solid #f59e0b; }
.ticket-card.en_tiempo { border-top: 4px solid #10b981; }

/* Debe ir después de las reglas de color de arriba para ganar por orden */
.ticket-card.finalizado {
  background: #f1f5f9;
  border-top-color: #94a3b8;
  opacity: 0.6;
}

.ticket-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  color: #1e293b;
}

.ticket-description {
  color: #475569;
  font-size: 0.9rem;
  margin: 0 0 1rem 0;
  flex-grow: 1;
}

.ticket-tiempo {
  font-size: 0.9rem;
  font-weight: 600;
  color: #334155;
  margin: 0 0 1rem 0;
}

.etiqueta-pausa {
  margin-left: 0.5rem;
  padding: 0.15rem 0.5rem;
  border-radius: 20px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 0.7rem;
  text-transform: uppercase;
}

.ticket-meta {
  border-top: 1px solid #f1f5f9;
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: #64748b;
}

.ticket-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.ticket-actions button {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.8rem;
}

.ticket-actions button:hover {
  background: #f1f5f9;
}

.btn-resolver {
  border-color: #10b981;
  color: #065f46;
}
</style>