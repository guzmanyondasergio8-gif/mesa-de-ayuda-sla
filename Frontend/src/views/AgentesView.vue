<template>
  <div class="agentes">
    <h1>Agentes de soporte</h1>
    <p class="subtitulo">Solo los administradores pueden ver esta página y crear agentes.</p>

    <div class="columnas">
      <section class="tarjeta">
        <h2>Nuevo agente</h2>
        <form @submit.prevent="enviar">
          <label>
            Nombre
            <input v-model="nombre" type="text" placeholder="Nombre y apellido" required />
          </label>
          <label>
            Correo
            <input v-model="correo" type="email" placeholder="correo@empresa.com" required />
          </label>
          <label>
            Contraseña
            <input v-model="password" type="password" placeholder="Mínimo 6 caracteres" minlength="6" required />
          </label>
          <label>
            Rol
            <select v-model="rol">
              <option value="Agente">Agente</option>
              <option value="Administrador">Administrador</option>
            </select>
          </label>

          <button type="submit" :disabled="enviando">
            {{ enviando ? 'Creando...' : 'Crear agente' }}
          </button>

          <p v-if="error" class="mensaje-error">{{ error }}</p>
          <p v-if="exito" class="mensaje-exito">{{ exito }}</p>
        </form>
      </section>

      <section class="tarjeta">
        <h2>Registrados ({{ agentes.length }})</h2>
        <p v-if="cargando" class="vacio">Cargando...</p>
        <ul v-else class="lista">
          <li v-for="a in agentes" :key="a.id">
            <div>
              <strong>{{ a.nombre }}</strong>
              <span class="correo">{{ a.correo }}</span>
            </div>
            <span class="rol" :class="{ admin: a.rol === 'Administrador' }">{{ a.rol }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { obtenerAgentes, crearAgente } from '@/services/api'

const agentes = ref([])
const cargando = ref(true)

const nombre = ref('')
const correo = ref('')
const password = ref('')
const rol = ref('Agente')
const enviando = ref(false)
const error = ref('')
const exito = ref('')

async function cargar() {
  try {
    agentes.value = await obtenerAgentes()
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

async function enviar() {
  error.value = ''
  exito.value = ''
  enviando.value = true
  try {
    const { agente } = await crearAgente({
      nombre: nombre.value,
      correo: correo.value,
      password: password.value,
      rol: rol.value
    })
    exito.value = `Agente ${agente.nombre} creado. Ya puede iniciar sesión.`
    nombre.value = ''
    correo.value = ''
    password.value = ''
    rol.value = 'Agente'
    await cargar()
  } catch (e) {
    error.value = e.message
  } finally {
    enviando.value = false
  }
}
</script>

<style scoped>
.agentes {
  padding: 2rem;
  max-width: 1000px;
  margin: 0 auto;
  font-family: system-ui, -apple-system, sans-serif;
  color: #333;
}

h1 {
  margin: 0;
  font-size: 1.75rem;
  color: #1e293b;
}

.subtitulo {
  color: #64748b;
  margin: 0.25rem 0 1.5rem;
}

.columnas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  align-items: start;
}

.tarjeta {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1.25rem;
}

h2 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  color: #1e293b;
}

form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #334155;
}

input,
select {
  padding: 0.6rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: inherit;
  font-weight: 400;
}

button[type='submit'] {
  padding: 0.7rem 1rem;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
}

button[type='submit']:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.mensaje-error {
  color: #dc2626;
  margin: 0;
  font-size: 0.9rem;
}

.mensaje-exito {
  color: #047857;
  margin: 0;
  font-size: 0.9rem;
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
}

.lista li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.lista li:last-child {
  border-bottom: none;
}

.correo {
  display: block;
  color: #64748b;
  font-size: 0.85rem;
}

.rol {
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
  background: #e2e8f0;
  color: #334155;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.rol.admin {
  background: #dbeafe;
  color: #1e40af;
}

.vacio {
  color: #64748b;
}
</style>
