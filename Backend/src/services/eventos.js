// Bus de eventos interno. Los servicios avisan aquí lo que pasó
// (ticket creado, actualizado, cambio de color del SLA, escalado) sin saber
// quién escucha. El módulo de sockets se suscribe y lo reenvía a los navegadores.
// Así la lógica de negocio no depende de Socket.io.
const { EventEmitter } = require('events');

const eventos = new EventEmitter();

const EVENTOS = {
  TICKET_CREADO: 'ticket:creado',
  TICKET_ACTUALIZADO: 'ticket:actualizado',
  SLA_CAMBIO: 'sla:cambio',
  TICKET_ESCALADO: 'ticket:escalado',
  TICKET_ELIMINADO: 'ticket:eliminado',
  TICKETS_LIMPIADOS: 'tickets:limpiados'
};

module.exports = { eventos, EVENTOS };
