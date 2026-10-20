// Tiempo límite de resolución en minutos según la prioridad
const TIEMPOS_SLA_MINUTOS = {
  Baja: 1440,    // 24 horas
  Media: 480,    // 8 horas
  Alta: 120,     // 2 horas
  'Crítica': 30  // 30 minutos
};

const ESTADOS = ['Abierto', 'En Progreso', 'En Espera', 'Resuelto', 'Cerrado'];

const ESTADOS_FINALES = ['Resuelto', 'Cerrado'];

// Si queda este porcentaje del tiempo (o menos), el ticket pasa a "por vencer"
const PORCENTAJE_POR_VENCER = 0.25;

// Quita tildes y espacios para comparar textos sin importar cómo los escriban
function normalizarTexto(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

// Convierte "critica", "CRITICA", "Crítica"... en la clave oficial ("Crítica").
// Devuelve null si la prioridad no existe.
function normalizarPrioridad(prioridad) {
  if (!prioridad) return null;
  const buscada = normalizarTexto(prioridad);
  return Object.keys(TIEMPOS_SLA_MINUTOS).find(
    (clave) => normalizarTexto(clave) === buscada
  ) || null;
}

// Convierte "en espera", "EN ESPERA"... en el estado oficial ("En Espera").
// Devuelve null si el estado no existe.
function normalizarEstado(estado) {
  if (!estado) return null;
  const buscado = normalizarTexto(estado);
  return ESTADOS.find((e) => normalizarTexto(e) === buscado) || null;
}

// Calcula el semáforo del SLA a partir de los minutos ya consumidos
function calcularEstadoSla(tiempoLimite, minutosTranscurridos) {
  const minutosRestantes = tiempoLimite - minutosTranscurridos;

  let estadoSla = 'en_tiempo';                       // Verde
  if (minutosRestantes <= 0) {
    estadoSla = 'vencido';                           // Rojo
  } else if (minutosRestantes <= tiempoLimite * PORCENTAJE_POR_VENCER) {
    estadoSla = 'por_vencer';                        // Amarillo
  }

  return { minutosRestantes, estadoSla };
}

// Recibe una fila de la BD (con minutos_sla ya calculado en SQL)
// y le agrega los campos de SLA que consume el Frontend.
function agregarInfoSla(fila) {
  const { minutos_sla, ...ticket } = fila;
  const transcurridos = Number(minutos_sla) || 0;
  const { minutosRestantes, estadoSla } = calcularEstadoSla(
    ticket.tiempo_limite_resolucion,
    transcurridos
  );

  return {
    ...ticket,
    tiempo_transcurrido_minutos: transcurridos,
    minutos_restantes: minutosRestantes,
    estado_sla: estadoSla
  };
}

module.exports = {
  TIEMPOS_SLA_MINUTOS,
  ESTADOS,
  ESTADOS_FINALES,
  normalizarPrioridad,
  normalizarEstado,
  calcularEstadoSla,
  agregarInfoSla
};