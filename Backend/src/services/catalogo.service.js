// Valores válidos para llenar formularios y filtros en el Frontend
const { TIEMPOS_SLA_MINUTOS, ESTADOS } = require('./sla.service');

function obtener() {
  return {
    prioridades: Object.entries(TIEMPOS_SLA_MINUTOS).map(([nombre, minutos]) => ({
      nombre,
      minutos_sla: minutos
    })),
    estados: ESTADOS,
    estados_sla: [
      { valor: 'en_tiempo', etiqueta: 'En Tiempo', color: 'verde' },
      { valor: 'por_vencer', etiqueta: 'Por Vencer', color: 'amarillo' },
      { valor: 'vencido', etiqueta: 'Vencido', color: 'rojo' }
    ]
  };
}

module.exports = { obtener };
