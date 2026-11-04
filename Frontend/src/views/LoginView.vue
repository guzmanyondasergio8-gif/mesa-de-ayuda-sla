<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="enviar">
      <h1>Iniciar sesión</h1>
      <p class="subtitulo">Mesa de ayuda · Dashboard de SLAs</p>

      <label>
        Correo
        <input v-model="correo" type="email" placeholder="correo@empresa.com" required />
      </label>

      <label>
        Contraseña
        <input v-model="password" type="password" placeholder="Tu contraseña" required />
      </label>

      <button type="submit" :disabled="cargando">
        {{ cargando ? 'Ingresando...' : 'Iniciar sesión' }}
      </button>

      <p v-if="error" class="mensaje-error">{{ error }}</p>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const router = useRouter()
const auth = useAuthStore()

const correo = ref('')
const password = ref('')
const cargando = ref(false)
const error = ref('')

async function enviar() {
  error.value = ''
  cargando.value = true
  try {
    await auth.iniciarSesion(correo.value, password.value)
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  font-family: system-ui, -apple-system, sans-serif;
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: #fff;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-card h1 {
  margin: 0;
  font-size: 1.6rem;
  color: #1e293b;
}

.subtitulo {
  margin: 0 0 0.5rem 0;
  color: #64748b;
  font-size: 0.9rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #334155;
}

input {
  padding: 0.6rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: inherit;
  font-weight: 400;
}

button {
  padding: 0.7rem 1rem;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.mensaje-error {
  color: #dc2626;
  margin: 0;
  font-size: 0.9rem;
}
</style>