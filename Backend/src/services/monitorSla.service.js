// Monitor del SLA en tiempo real.
// Cada cierto tiempo (30 s por defecto) revisa los tickets activos y:
//  - Si un ticket cambió de color (verde -> amarillo -> rojo), emite SLA_CAMBIO.
//  - Si un ticket acaba de vencer, lo registra en historial_escalados
//    (una sola vez por ticket) y emite TICKET_ESCALADO.
// El módulo de sockets reenvía esos eventos a los navegadores conectados.
const ticketRepo = require('../repositories/ticket.repository');
const historialRepo = require('../repositories/historial.repository');
const refreshRepo = require('../repositories/refreshToken.repository');
const { agregarInfoSla, ESTADOS_FINALES } = require('./sla.service');
const { eventos, EVENTOS } = require('./eventos');

const INTERVALO_MS = (Number(process.env.SLA_MONITOR_SEGUNDOS) || 30) * 1000;

// Último color conocido de cada ticket: id -> 'en_tiempo' | 'por_vencer' | 'vencido'
const ultimoEstado = new Map();
let temporizador = null;
let revisando = false;

function minutosATexto(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

async function revisar() {
  if (revisando) return;            // Si una revisión tarda, no se encima con la siguiente
  revisando = true;
  try {
    const tickets = (await ticketRepo.listarActivos()).map(agregarInfoSla);
    const vistos = new Set();

    for (const ticket of tickets) {
      vistos.add(ticket.id);
      const anterior = ultimoEstado.get(ticket.id);
      ultimoEstado.set(ticket.id, ticket.estado_sla);

      // Escalar: ticket vencido que todavía no está en el historial
      if (ticket.estado_sla === 'vencido' && !ticket.escalado) {
        const registro = await historialRepo.registrar(
          ticket.id,
          `SLA vencido: prioridad ${ticket.prioridad}, límite de ${minutosATexto(ticket.tiempo_limite_resolucion)}`
        );
        ticket.escalado = true;
        eventos.emit(EVENTOS.TICKET_ESCALADO, { ticket, registro });
      }

      if (anterior && anterior !== ticket.estado_sla) {
        eventos.emit(EVENTOS.SLA_CAMBIO, { ticket, anterior });
      }
    }

    // Olvidar tickets que ya se resolvieron o cerraron
    for (const id of ultimoEstado.keys()) {
      if (!vistos.has(id)) ultimoEstado.delete(id);
    }
  } catch (error) {
    console.error('Error en el monitor del SLA:', error.message);
  } finally {
    revisando = false;
  }
}

// Cuando un ticket se crea o se actualiza por la API, el monitor anota su color
// de inmediato. Así detecta el siguiente cambio aunque ocurra antes de su
// próxima revisión.
function recordarTicket(ticket) {
  if (ESTADOS_FINALES.includes(ticket.estado)) ultimoEstado.delete(ticket.id);
  else ultimoEstado.set(ticket.id, ticket.estado_sla);
}

function iniciar() {
  if (temporizador) return;
  eventos.on(EVENTOS.TICKET_CREADO, recordarTicket);
  eventos.on(EVENTOS.TICKET_ACTUALIZADO, recordarTicket);
  eventos.on(EVENTOS.TICKET_ELIMINADO, ({ id }) => ultimoEstado.delete(id));
  eventos.on(EVENTOS.TICKETS_LIMPIADOS, () => ultimoEstado.clear());
  revisar();
  temporizador = setInterval(revisar, INTERVALO_MS);
  // Limpieza de refresh tokens vencidos una vez por hora
  setInterval(() => refreshRepo.eliminarExpirados().catch(() => {}), 60 * 60 * 1000).unref();
  console.log(`Monitor del SLA activo (revisa cada ${INTERVALO_MS / 1000} s)`);
}

function detener() {
  clearInterval(temporizador);
  temporizador = null;
}

module.exports = { iniciar, detener, revisar };
