// Conexión en tiempo real con el Backend (Socket.io).
// El Backend avisa cuando se crea o actualiza un ticket, cuando un ticket cambia
// de color en el semáforo del SLA y cuando un ticket vence (escalado).
import { ref } from 'vue'
import { io } from 'socket.io-client'
import { API_URL } from './api'
import { useAuthStore } from '@/store/auth'

export const EVENTOS = {
  TICKET_CREADO: 'ticket:creado',
  TICKET_ACTUALIZADO: 'ticket:actualizado',
  SLA_CAMBIO: 'sla:cambio',
  TICKET_ESCALADO: 'ticket:escalado',
  TICKET_ELIMINADO: 'ticket:eliminado',
  TICKETS_LIMPIADOS: 'tickets:limpiados'
}

// true mientras hay conexión; la barra lo muestra como "En vivo"
export const conectado = ref(false)

let socket = null

export function conectar() {
  if (socket) return
  const auth = useAuthStore()

  socket = io(API_URL, {
    // Función: en cada reconexión envía el access token vigente
    auth: (cb) => cb({ token: auth.accessToken })
  })

  socket.on('connect', () => { conectado.value = true })
  socket.on('disconnect', () => { conectado.value = false })

  // Si el token venció mientras estaba desconectado, se renueva y se reintenta
  socket.on('connect_error', async (error) => {
    conectado.value = false
    if (error.message === 'TOKEN_EXPIRADO' && (await auth.renovar())) {
      socket.connect()
    }
  })
}

export function desconectar() {
  if (!socket) return
  socket.disconnect()
  socket = null
  conectado.value = false
}

// Escucha un evento. Devuelve una función para dejar de escucharlo.
export function escuchar(evento, fn) {
  if (!socket) conectar()
  socket.on(evento, fn)
  return () => socket?.off(evento, fn)
}
