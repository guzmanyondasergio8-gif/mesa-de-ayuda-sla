// Todas las llamadas al Backend pasan por este archivo.
// Si algo falla, las funciones lanzan un Error cuyo .message es el mensaje de la API.
//
// Sesión (doble token):
//  - El access token vive EN MEMORIA (store de Pinia) y se envía en cada petición.
//  - El refresh token vive en una cookie HttpOnly que pone el Backend; este código
//    nunca lo ve. Por eso las rutas /auth/* usan credentials: 'include'.
import { useAuthStore } from '@/store/auth'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function leerRespuesta(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || `Error ${res.status} en la petición`)
    error.status = res.status
    error.codigo = data.codigo
    throw error
  }
  return data
}

// ---------------------------------------------------------------------------
// Autenticación (rutas públicas; la cookie del refresh token viaja sola)
// ---------------------------------------------------------------------------
function peticionAuth(ruta, cuerpo) {
  return fetch(`${API_URL}/api/auth${ruta}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  }).then(leerRespuesta)
}

// Devuelve { access_token, token_type, expires_in, agente } y deja la cookie puesta
export const login = (correo, password) => peticionAuth('/login', { correo, password })

// Usa la cookie para obtener un access token nuevo (misma respuesta que el login)
export const refrescar = () => peticionAuth('/refresh')

// Borra el refresh token en el servidor y la cookie
export const logout = () => peticionAuth('/logout')

// ---------------------------------------------------------------------------
// Rutas protegidas: envían el access token y lo renuevan si venció
// ---------------------------------------------------------------------------
async function peticion(ruta, opciones = {}, reintentar = true) {
  const auth = useAuthStore()
  const res = await fetch(`${API_URL}/api${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {})
    }
  })

  if (res.status === 401) {
    const data = await res.clone().json().catch(() => ({}))
    // Token vencido: se renueva UNA vez (el store evita refresh simultáneos) y se repite
    if (data.codigo === 'TOKEN_EXPIRADO' && reintentar) {
      const renovado = await auth.renovar()
      if (renovado) return peticion(ruta, opciones, false)
    }
    auth.sesionExpirada()
  }

  return leerRespuesta(res)
}

// Lista de tickets (cada uno trae estado_sla, minutos_restantes, agente_nombre y escalado)
export const obtenerTickets = () => peticion('/tickets')

export const obtenerTicket = (id) => peticion(`/tickets/${id}`)

// Historial de escalados de un ticket
export const obtenerHistorial = (id) => peticion(`/tickets/${id}/historial`)

// datos = { titulo, descripcion, prioridad, agente_id }  ->  { mensaje, ticket }
export const crearTicket = (datos) =>
  peticion('/tickets', { method: 'POST', body: JSON.stringify(datos) })

// "En Espera" pausa, "En Progreso"/"Abierto" reanuda, "Resuelto"/"Cerrado" finaliza
export const actualizarEstado = (id, estado) =>
  peticion(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify({ estado }) })

// Solo Administrador: borra un ticket y su historial
export const eliminarTicket = (id) => peticion(`/tickets/${id}`, { method: 'DELETE' })

// Solo Administrador: borra todos los tickets
export const eliminarTodosLosTickets = () => peticion('/tickets', { method: 'DELETE' })

// [{ id, nombre, correo, rol }]
export const obtenerAgentes = () => peticion('/agentes')

// { nombre, correo, password, rol }  ->  { mensaje, agente }   (solo Administrador)
export const crearAgente = (datos) =>
  peticion('/agentes', { method: 'POST', body: JSON.stringify(datos) })

// { prioridades: [{ nombre, minutos_sla }], estados: [...], estados_sla: [...] }
export const obtenerCatalogos = () => peticion('/catalogos')
