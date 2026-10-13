<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h1>Dashboard de SLAs</h1>
      <p>Gestión y monitoreo de tickets de soporte</p>
    </header>

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
        :class="getSlaClass(ticket)"
      >
        <div class="ticket-header">
          <span class="ticket-id">#{{ ticket.id }}</span>
          <span class="ticket-badge" :class="getSlaClass(ticket)">
            {{ getSlaText(ticket) }}
          </span>
        </div>

        <h3 class="ticket-title">{{ ticket.titulo || ticket.asunto }}</h3>
        <p class="ticket-description">{{ ticket.descripcion }}</p>

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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ticketsData from '@/data/tickets.json'

const tickets = ref(ticketsData)

function getSlaState(ticket) {
  if (ticket.slaState) return ticket.slaState 

  const horasRestantes = ticket.horasRestantes
  if (horasRestantes !== undefined) {
    if (horasRestantes <= 0) return 'vencido'
    if (horasRestantes <= 4) return 'por_vencer'
    return 'en_tiempo'
  }

  return 'en_tiempo'
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

.ticket-meta {
  border-top: 1px solid #f1f5f9;
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: #64748b;
}
</style>