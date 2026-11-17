import { defineStore } from 'pinia'
import { login, refrescar, logout } from '@/services/api'

// Promesas compartidas: si varias partes de la app piden lo mismo a la vez,
// todas esperan la MISMA petición (el backend toma dos refresh simultáneos con
// el mismo token como un robo y cierra la sesión).
let renovacionEnCurso = null
let restauracion = null

export const useAuthStore = defineStore('auth', {
  // El access token vive solo en memoria: al recargar la página se pierde y se
  // recupera con la cookie HttpOnly del refresh token (restaurarSesion).
  state: () => ({
    agente: null,
    accessToken: null
  }),

  getters: {
    estaAutenticado: (state) => !!state.accessToken,
    esAdmin: (state) => state.agente?.rol === 'Administrador'
  },

  actions: {
    guardarSesion(data) {
      this.agente = data.agente
      this.accessToken = data.access_token
    },

    limpiar() {
      this.agente = null
      this.accessToken = null
    },

    async iniciarSesion(correo, password) {
      this.guardarSesion(await login(correo, password))
    },

    // Pide un access token nuevo con la cookie. Devuelve true si lo logró.
    renovar() {
      if (!renovacionEnCurso) {
        renovacionEnCurso = refrescar()
          .then((data) => {
            this.guardarSesion(data)
            return true
          })
          .catch(() => {
            this.limpiar()
            return false
          })
          .finally(() => {
            renovacionEnCurso = null
          })
      }
      return renovacionEnCurso
    },

    // Al abrir o recargar la página: si la cookie sigue vigente, recupera la sesión
    // sin pedir la contraseña. Solo se intenta una vez por carga de la página.
    restaurarSesion() {
      if (!restauracion) {
        restauracion = this.estaAutenticado ? Promise.resolve(true) : this.renovar()
      }
      return restauracion
    },

    async cerrarSesion() {
      try {
        await logout()
      } catch (e) {
        // Si falla (por ejemplo, sin conexión), igual se cierra la sesión aquí
      }
      this.limpiar()
    },

    // La API dijo que la sesión ya no sirve: limpiar y volver al login
    sesionExpirada() {
      this.limpiar()
      if (window.location.pathname !== '/login') {
        window.location.assign('/login?expirada=1')
      }
    }
  }
})
