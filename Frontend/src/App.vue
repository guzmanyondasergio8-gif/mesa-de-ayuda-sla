<template>
  <nav v-if="auth.estaAutenticado" class="barra">
    <router-link to="/" class="marca" aria-label="Mesa de Ayuda SLA, ir al dashboard">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#2563eb" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" stroke-width="2.5" />
        <path d="M16 11v5.5l3.5 2" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" />
      </svg>
      <span>Mesa de Ayuda <strong>SLA</strong></span>
    </router-link>
    <router-link to="/">Dashboard</router-link>
    <router-link to="/tickets/nuevo">Nuevo ticket</router-link>
    <router-link v-if="auth.esAdmin" to="/agentes">Agentes</router-link>

    <div class="usuario">
      <span class="en-vivo" :class="{ activo: conectado }">
        {{ conectado ? 'En vivo' : 'Sin conexión' }}
      </span>
      <span>{{ auth.agente?.nombre }} · {{ auth.agente?.rol }}</span>
      <button type="button" class="btn-salir" @click="salir">Cerrar sesión</button>
    </div>
  </nav>

  <router-view />

  <!-- Avisos en tiempo real del monitor del SLA -->
  <div class="avisos" aria-live="polite">
    <div v-for="aviso in avisos" :key="aviso.id" class="aviso" :class="aviso.tipo">
      <strong>{{ aviso.titulo }}</strong>
      <span>{{ aviso.texto }}</span>
      <button type="button" class="cerrar" aria-label="Cerrar aviso" @click="quitarAviso(aviso.id)">×</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { conectar, desconectar, escuchar, conectado, EVENTOS } from '@/services/tiempoReal'

const router = useRouter()
const auth = useAuthStore()

// ---- Avisos (se cierran solos a los 8 segundos) ----
const avisos = ref([])
let siguienteId = 1

function mostrarAviso(tipo, titulo, texto) {
  const id = siguienteId++
  avisos.value.push({ id, tipo, titulo, texto })
  setTimeout(() => quitarAviso(id), 8000)
}

function quitarAviso(id) {
  avisos.value = avisos.value.filter((a) => a.id !== id)
}

// ---- Conexión en tiempo real mientras haya sesión ----
let dejarDeEscuchar = []

function iniciarTiempoReal() {
  conectar()
  dejarDeEscuchar = [
    escuchar(EVENTOS.SLA_CAMBIO, ({ ticket }) => {
      if (ticket.estado_sla === 'por_vencer') {
        mostrarAviso('por_vencer', `Ticket #${ticket.id} por vencer`, `${ticket.titulo}: quedan ${ticket.minutos_restantes} min`)
      }
    }),
    escuchar(EVENTOS.TICKET_ESCALADO, ({ ticket }) => {
      mostrarAviso('vencido', `Ticket #${ticket.id} venció y fue escalado`, `${ticket.titulo} (prioridad ${ticket.prioridad})`)
    })
  ]
}

function detenerTiempoReal() {
  dejarDeEscuchar.forEach((dejar) => dejar())
  dejarDeEscuchar = []
  desconectar()
}

watch(
  () => auth.estaAutenticado,
  (activo) => (activo ? iniciarTiempoReal() : detenerTiempoReal()),
  { immediate: true }
)

onUnmounted(detenerTiempoReal)

async function salir() {
  await auth.cerrarSesion()
  router.push({ name: 'login' })
}
</script>

<style>
body {
  margin: 0;
  background: #f8fafc;
}
</style>

<style scoped>
.barra {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding: 1rem 2rem;
  background: #1e293b;
  font-family: system-ui, -apple-system, sans-serif;
}

.barra a {
  color: #e2e8f0;
  text-decoration: none;
  font-weight: 600;
  padding-bottom: 0.25rem;
  border-bottom: 2px solid transparent;
}

.barra a.marca {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin-right: 0.75rem;
  padding-bottom: 0;
  border-bottom: none;
  color: #fff;
  font-weight: 500;
  font-size: 1.05rem;
}

.barra a.marca svg {
  width: 30px;
  height: 30px;
}

.barra a.marca strong {
  color: #7dd3fc;
}

.barra a:hover {
  color: #fff;
}

.barra a.router-link-exact-active {
  color: #fff;
  border-bottom-color: #38bdf8;
}

.usuario {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #cbd5e1;
  font-size: 0.9rem;
}

.en-vivo {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #94a3b8;
}

.en-vivo::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
}

.en-vivo.activo {
  color: #6ee7b7;
}

.en-vivo.activo::before {
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
}

.btn-salir {
  background: transparent;
  color: #e2e8f0;
  border: 1px solid #475569;
  border-radius: 6px;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
  font: inherit;
}

.btn-salir:hover {
  border-color: #f87171;
  color: #fff;
}

.avisos {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 50;
  max-width: min(360px, calc(100vw - 2rem));
  font-family: system-ui, -apple-system, sans-serif;
}

.aviso {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem 2.25rem 0.75rem 1rem;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.15);
  border-left: 5px solid #64748b;
  font-size: 0.85rem;
  color: #334155;
}

.aviso strong {
  color: #0f172a;
}

.aviso.por_vencer { border-left-color: #f59e0b; }
.aviso.vencido { border-left-color: #ef4444; }

.cerrar {
  position: absolute;
  top: 0.4rem;
  right: 0.5rem;
  border: none;
  background: none;
  font-size: 1.1rem;
  line-height: 1;
  color: #94a3b8;
  cursor: pointer;
}
</style>
