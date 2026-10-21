<template>
  <div class="nuevo-ticket">
    <h1>Nuevo ticket</h1>

    <form @submit.prevent="enviar">
      <label>
        Título
        <input v-model="titulo" type="text" placeholder="Resumen del problema" />
      </label>

      <label>
        Descripción
        <textarea
          v-model="descripcion"
          rows="4"
          placeholder="Describe el problema con detalle"
        ></textarea>
      </label>

      <label>
        Prioridad
        <select v-model="prioridad">
          <option disabled value="">Selecciona una prioridad</option>
          <option v-for="p in prioridades" :key="p.nombre" :value="p.nombre">
            {{ etiquetaPrioridad(p) }}
          </option>
        </select>
      </label>

      <label>
        Agente
        <select v-model="agente_id">
          <option :value="null">Sin asignar</option>
          <option v-for="a in agentes" :key="a.id" :value="a.id">
            {{ a.nombre }}
          </option>
        </select>
      </label>

      <button type="submit" :disabled="enviando">
        {{ enviando ? 'Creando...' : 'Crear ticket' }}
      </button>

      <p v-if="error" class="mensaje-error">{{ error }}</p>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { crearTicket, obtenerAgentes, obtenerCatalogos } from '@/services/api'

const router = useRouter()

const titulo = ref('')
const descripcion = ref('')
const prioridad = ref('')
const agente_id = ref(null)

const prioridades = ref([])
const agentes = ref([])
const error = ref('')
const enviando = ref(false)

function etiquetaPrioridad(p) {
  const tiempo = p.minutos_sla >= 60 ? `${p.minutos_sla / 60} h` : `${p.minutos_sla} min`
  return `${p.nombre} (${tiempo})`
}

onMounted(async () => {
  try {
    const catalogos = await obtenerCatalogos()
    prioridades.value = catalogos.prioridades
    agentes.value = await obtenerAgentes()
  } catch (e) {
    error.value = e.message
  }
})

async function enviar() {
  error.value = ''
  enviando.value = true
  try {
    await crearTicket({
      titulo: titulo.value,
      descripcion: descripcion.value,
      prioridad: prioridad.value,
      agente_id: agente_id.value
    })
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    enviando.value = false
  }
}
</script>

<style scoped>
.nuevo-ticket {
  padding: 2rem;
  max-width: 600px;
  margin: 0 auto;
  font-family: system-ui, -apple-system, sans-serif;
  color: #333;
}

.nuevo-ticket h1 {
  margin: 0 0 1.5rem 0;
  font-size: 1.75rem;
  color: #1e293b;
}

form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
textarea,
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
}
</style>