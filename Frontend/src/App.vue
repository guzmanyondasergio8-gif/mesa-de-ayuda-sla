<template>
  <nav v-if="auth.estaAutenticado" class="barra">
    <router-link to="/">Dashboard</router-link>
    <router-link to="/tickets/nuevo">Nuevo ticket</router-link>

    <div class="usuario">
      <span>{{ auth.agente?.nombre }} · {{ auth.agente?.rol }}</span>
      <button type="button" class="btn-salir" @click="salir">Cerrar sesión</button>
    </div>
  </nav>

  <router-view />
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { logout } from '@/services/api'

const router = useRouter()
const auth = useAuthStore()

async function salir() {
  try {
    // Invalida el refresh_token en el servidor
    await logout(auth.refreshToken)
  } catch (e) {
    // Si falla (por ejemplo, sin conexión), igual se cierra la sesión aquí
  }
  auth.cerrarSesion()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.barra {
  display: flex;
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

.barra a:hover {
  color: #fff;
}

.usuario {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #cbd5e1;
  font-size: 0.9rem;
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
.barra a.router-link-exact-active {
  color: #fff;
  border-bottom-color: #38bdf8;
}
</style>