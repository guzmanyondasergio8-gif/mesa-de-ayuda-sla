// Reglas de negocio de los tickets: validaciones, asignación del SLA,
// pausa/reanudación del reloj y resolución. El SQL está en el repositorio.
const { conTransaccion } = require('../config/db');
const ticketRepo = require('../repositories/ticket.repository');
const historialRepo = require('../repositories/historial.repository');
const { ErrorApp } = require('../utils/errores');
const { eventos, EVENTOS } = require('./eventos');
const {
  TIEMPOS_SLA_MINUTOS,
  ESTADOS,
  ESTADOS_FINALES,
  normalizarPrioridad,
  normalizarEstado,
  agregarInfoSla
} = require('./sla.service');

function validarId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErrorApp(400, 'El id del ticket debe ser un número entero positivo.');
  }
  return id;
}

async function listar() {
  const filas = await ticketRepo.listar();
  return filas.map(agregarInfoSla);
}

async function obtener(idTexto) {
  const ticket = await ticketRepo.buscarPorId(validarId(idTexto));
  if (!ticket) throw new ErrorApp(404, 'Ticket no encontrado');
  return agregarInfoSla(ticket);
}

async function historial(idTexto) {
  const id = validarId(idTexto);
  if (!(await ticketRepo.buscarPorId(id))) throw new ErrorApp(404, 'Ticket no encontrado');
  return historialRepo.listarPorTicket(id);
}

// Crea el ticket y le asigna el tiempo límite según la prioridad
async function crear({ titulo, descripcion, prioridad, agente_id }) {
  if (!titulo || !descripcion || !prioridad) {
    throw new ErrorApp(400, 'Título, descripción y prioridad son obligatorios.');
  }

  const prioridadValida = normalizarPrioridad(prioridad);
  if (!prioridadValida) {
    throw new ErrorApp(
      400,
      `Prioridad no válida. Valores permitidos: ${Object.keys(TIEMPOS_SLA_MINUTOS).join(', ')}.`
    );
  }

  const tieneAgente = agente_id !== undefined && agente_id !== null && agente_id !== '';
  if (tieneAgente && !Number.isInteger(Number(agente_id))) {
    throw new ErrorApp(400, 'El agente_id debe ser un número entero.');
  }

  const fila = await ticketRepo.crear({
    titulo: String(titulo).trim(),
    descripcion: String(descripcion).trim(),
    prioridad: prioridadValida,
    agenteId: tieneAgente ? Number(agente_id) : null,
    tiempoLimite: TIEMPOS_SLA_MINUTOS[prioridadValida]
  });

  const ticket = agregarInfoSla(fila);
  eventos.emit(EVENTOS.TICKET_CREADO, ticket);
  return ticket;
}

// Cambia el estado y pausa/reanuda/congela el reloj del SLA:
//  - "En Espera" (o en_espera: true) pausa el reloj.
//  - Salir de la espera lo reanuda, sin contar el tiempo pausado.
//  - "Resuelto" o "Cerrado" detiene el reloj definitivamente.
//  - Reabrir un ticket resuelto reanuda el reloj sin contar el tiempo que estuvo resuelto.
//  - Si envían "estado" y "en_espera" juntos, manda "estado".
//
// Propiedad del recurso: un Agente solo puede cambiar tickets asignados a él
// o sin asignar; el Administrador puede cambiar cualquiera.
function puedeGestionar(usuario, agenteIdDelTicket) {
  if (!usuario) return true;                       // uso interno (scripts, pruebas)
  if (usuario.rol === 'Administrador') return true;
  return agenteIdDelTicket === null || agenteIdDelTicket === usuario.id;
}

async function cambiarEstado(idTexto, { estado, en_espera }, usuario) {
  const id = validarId(idTexto);

  if (estado === undefined && en_espera === undefined) {
    throw new ErrorApp(400, 'Debe enviar "estado" y/o "en_espera".');
  }

  let estadoValido = null;
  if (estado !== undefined) {
    estadoValido = normalizarEstado(estado);
    if (!estadoValido) {
      throw new ErrorApp(400, `Estado no válido. Valores permitidos: ${ESTADOS.join(', ')}.`);
    }
  }

  if (en_espera !== undefined && typeof en_espera !== 'boolean') {
    throw new ErrorApp(400, 'El campo en_espera debe ser true o false.');
  }

  const fila = await conTransaccion(async (client) => {
    const actual = await ticketRepo.bloquearParaActualizar(client, id);
    if (!actual) throw new ErrorApp(404, 'Ticket no encontrado');
    if (!puedeGestionar(usuario, actual.agente_id)) {
      throw new ErrorApp(403, 'Solo puedes gestionar tickets asignados a ti o sin asignar.');
    }

    // Si solo envían en_espera, el estado se ajusta para que coincida con la pausa
    let nuevoEstado = estadoValido || actual.estado;
    if (!estadoValido && en_espera !== undefined && !ESTADOS_FINALES.includes(actual.estado)) {
      if (en_espera) nuevoEstado = 'En Espera';
      else if (actual.estado === 'En Espera') nuevoEstado = 'En Progreso';
    }
    const esFinal = ESTADOS_FINALES.includes(nuevoEstado);

    let nuevoEnEspera;
    if (esFinal) nuevoEnEspera = false;                  // Un ticket resuelto no puede estar en pausa
    else if (estadoValido) nuevoEnEspera = estadoValido === 'En Espera';
    else if (en_espera !== undefined) nuevoEnEspera = en_espera;
    else nuevoEnEspera = actual.en_espera;

    let minutosASumar = 0;
    let accionPausa = 'mantener';
    let accionResolucion = 'mantener';

    // Pausar o reanudar
    if (nuevoEnEspera && !actual.pausado_desde) {
      accionPausa = 'iniciar';
    } else if (!nuevoEnEspera && actual.pausado_desde) {
      accionPausa = 'quitar';
      minutosASumar += actual.minutos_en_pausa || 0;
    }

    // Resolver o reabrir
    if (esFinal && !actual.fecha_resolucion) {
      accionResolucion = 'iniciar';
    } else if (!esFinal && actual.fecha_resolucion) {
      accionResolucion = 'quitar';
      minutosASumar += actual.minutos_resuelto || 0;
    }

    return ticketRepo.actualizarEstado(client, id, {
      estado: nuevoEstado,
      enEspera: nuevoEnEspera,
      minutosASumar,
      accionPausa,
      accionResolucion
    });
  });

  const ticket = agregarInfoSla(fila);
  eventos.emit(EVENTOS.TICKET_ACTUALIZADO, ticket);
  return ticket;
}

// Solo Administrador (lo controla la ruta con permitirRoles)
async function eliminar(idTexto) {
  const id = validarId(idTexto);
  if (!(await ticketRepo.eliminar(id))) throw new ErrorApp(404, 'Ticket no encontrado');
  eventos.emit(EVENTOS.TICKET_ELIMINADO, { id });
}

async function eliminarTodos() {
  await ticketRepo.eliminarTodos();
  eventos.emit(EVENTOS.TICKETS_LIMPIADOS, {});
}

module.exports = {
  listar,
  obtener,
  historial,
  crear,
  cambiarEstado,
  eliminar,
  eliminarTodos,
  puedeGestionar
};
