const { TIEMPOS_SLA_MINUTOS, ESTADOS } = require('../services/sla.service');

// Devuelve los valores válidos para llenar formularios y filtros en el Frontend
const getCatalogos = (req, res) => {
  const prioridades = Object.entries(TIEMPOS_SLA_MINUTOS).map(([nombre, minutos]) => ({
    nombre,
    minutos_sla: minutos
  }));

  const estadosSla = [
    { valor: 'en_tiempo', etiqueta: 'En Tiempo', color: 'verde' },
    { valor: 'por_vencer', etiqueta: 'Por Vencer', color: 'amarillo' },
    { valor: 'vencido', etiqueta: 'Vencido', color: 'rojo' }
  ];

  res.json({
    prioridades,
    estados: ESTADOS,
    estados_sla: estadosSla
  });
};

module.exports = { getCatalogos };