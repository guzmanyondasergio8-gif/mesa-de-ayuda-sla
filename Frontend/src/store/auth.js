import { defineStore } from 'pinia'
import { login } from '@/services/api'

const CLAVE = 'sesion'

function cargarSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || {}
  } catch {
    return {}
  }
}

export const useAuthStore = defineStore('auth', {
  // Al crear el store se carga lo que haya en localStorage
  state: () => {
    const guardado = cargarSesion()
    return {
      agente: guardado.agente || null,
      accessToken: guardado.accessToken || null,
      refreshToken: guardado.refreshToken || null
    }
  },

  getters: {
    estaAutenticado: (state) => !!state.accessToken,
    esAdmin: (state) => state.agente?.rol === 'Administrador'
  },

  actions: {
    // Guarda la respuesta de login/refresh en el estado y en localStorage
    guardarSesion(data) {
      this.agente = data.agente || this.agente
      this.accessToken = data.access_token
      this.refreshToken = data.refresh_token
      localStorage.setItem(
        CLAVE,
        JSON.stringify({
          agente: this.agente,
          accessToken: this.accessToken,
          refreshToken: this.refreshToken
        })
      )
    },

    async iniciarSesion(correo, password) {
      const data = await login(correo, password)
      this.guardarSesion(data)
    },

    cerrarSesion() {
      this.agente = null
      this.accessToken = null
      this.refreshToken = null
      localStorage.removeItem(CLAVE)
    }
  }
})