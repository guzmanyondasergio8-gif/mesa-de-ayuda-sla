const pool = require('../config/db');
const {
  TIEMPOS_SLA_MINUTOS,
  ESTADOS,
  ESTADOS_FINALES,
  normalizarPrioridad,
  normalizarEstado,
  agregarInfoSla
} = require('../services/sla.service');

// Columnas a devolver + minutos de SLA consumidos, calculados en PostgreSQL.
// Minutos consumidos = (ahora o fecha de resolución) - fecha de creación
//                      - minutos que estuvo en pausa
//                      - minutos de la pausa actual (si está en espera)
// Se usa LOCALTIMESTAMP porque las fechas se guardan como TIMESTAMP (sin zona horaria).
const COLUMNAS_CON_SLA = `
  *,
  GREATEST(0,
    FLOOR(EXTRACT(EPOCH FROM (COALESCE(fecha_resolucion, LOCALTIMESTAMP) - fecha_creacion)) / 60)
    - COALESCE(minutos_pausados, 0)
    - CASE WHEN pausado_desde IS NOT NULL
        THEN FLOOR(EXTRACT(EPOCH FROM (COALESCE(fecha_resolucion, LOCALTIMESTAMP) - pausado_desde)) / 60)
        ELSE 0
      END
  )::int AS minutos_sla
`;

// Valida que el id de la URL sea un número entero positivo
function leerId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'El id del ticket debe ser un número entero positivo.' });
    return null;
  }
  return id;
}

// 1. Listar todos los tickets con su estado de SLA calculado
const getTickets = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${COLUMNAS_CON_SLA} FROM tickets ORDER BY fecha_creacion DESC`
    );
    res.json(result.rows.map(agregarInfoSla));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Obtener un ticket por id
const getTicketById = async (req, res) => {
  const id = leerId(req, res);
  if (id === null) return;

  try {
    const result = await pool.query(
      `SELECT ${COLUMNAS_CON_SLA} FROM tickets WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    res.json(agregarInfoSla(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Crear un nuevo ticket con cálculo inicial de SLA
const createTicket = async (req, res) => {
  const { titulo, descripcion, prioridad, agente_id } = req.body;

  if (!titulo || !descripcion || !prioridad) {
    return res.status(400).json({ error: 'Título, descripción y prioridad son obligatorios.' });
  }

  const prioridadValida = normalizarPrioridad(prioridad);
  if (!prioridadValida) {
    return res.status(400).json({
      error: `Prioridad no válida. Valores permitidos: ${Object.keys(TIEMPOS_SLA_MINUTOS).join(', ')}.`
    });
  }

  if (agente_id !== undefined && agente_id !== null && !Number.isInteger(Number(agente_id))) {
    return res.status(400).json({ error: 'El agente_id debe ser un número entero.' });
  }

  const tiempoLimite = TIEMPOS_SLA_MINUTOS[prioridadValida];

  try {
    const result = await pool.query(
      `INSERT INTO tickets (titulo, descripcion, prioridad, agente_id, tiempo_limite_resolucion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNAS_CON_SLA}`,
      [titulo, descripcion, prioridadValida, agente_id || null, tiempoLimite]
    );

    res.status(201).json({
      mensaje: 'Ticket creado con éxito',
      ticket: agregarInfoSla(result.rows[0])
    });
  } catch (error) {
    // 23503 = el agente indicado no existe en la tabla agentes
    if (error.code === '23503') {
      return res.status(400).json({ error: 'El agente indicado no existe.' });
    }
    res.status(500).json({ error: error.message });
  }
};

// 4. Actualizar estado del ticket y pausar/reanudar el reloj del SLA
//    - Pasar a "En Espera" (o en_espera: true) pausa el reloj.
//    - Salir de la espera lo reanuda, sin contar el tiempo pausado.
//    - Pasar a "Resuelto" o "Cerrado" detiene el reloj definitivamente.
//    - Reabrir un ticket resuelto reanuda el reloj sin contar el tiempo que estuvo resuelto.
const updateTicketStatus = async (req, res) => {
  const id = leerId(req, res);
  if (id === null) return;

  const { estado, en_espera } = req.body;

  if (estado === undefined && en_espera === undefined) {
    return res.status(400).json({ error: 'Debe enviar "estado" y/o "en_espera".' });
  }

  let estadoValido = null;
  if (estado !== undefined) {
    estadoValido = normalizarEstado(estado);
    if (!estadoValido) {
      return res.status(400).json({
        error: `Estado no válido. Valores permitidos: ${ESTADOS.join(', ')}.`
      });
    }
  }

  if (en_espera !== undefined && typeof en_espera !== 'boolean') {
    return res.status(400).json({ error: 'El campo en_espera debe ser true o false.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Se bloquea la fila para que dos actualizaciones simultáneas no se pisen
    const actualResult = await client.query(
      `SELECT estado, en_espera, pausado_desde, fecha_resolucion,
              FLOOR(EXTRACT(EPOCH FROM (LOCALTIMESTAMP - pausado_desde)) / 60)::int AS minutos_en_pausa,
              FLOOR(EXTRACT(EPOCH FROM (LOCALTIMESTAMP - fecha_resolucion)) / 60)::int AS minutos_resuelto
       FROM tickets WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (actualResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    const actual = actualResult.rows[0];

    // Si solo envían en_espera, el estado se ajusta para que coincida con la pausa
    let nuevoEstado = estadoValido || actual.estado;
    if (!estadoValido && en_espera !== undefined && !ESTADOS_FINALES.includes(actual.estado)) {
      if (en_espera) {
        nuevoEstado = 'En Espera';
      } else if (actual.estado === 'En Espera') {
        nuevoEstado = 'En Progreso';
      }
    }
    const esFinal = ESTADOS_FINALES.includes(nuevoEstado);

    // Determinar si el ticket queda en espera
     let nuevoEnEspera;
    if (esFinal) {
      nuevoEnEspera = false;                       // Un ticket resuelto no puede estar en pausa
    } else if (estadoValido) {
      nuevoEnEspera = estadoValido === 'En Espera';
    } else if (en_espera !== undefined) {
      nuevoEnEspera = en_espera;
    } else {
      nuevoEnEspera = actual.en_espera;
    }

    let minutosASumar = 0;
    let accionPausa = 'mantener';                  // 'iniciar' | 'quitar' | 'mantener'
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

    const result = await client.query(
      `UPDATE tickets
       SET estado = $1,
           en_espera = $2,
           minutos_pausados = COALESCE(minutos_pausados, 0) + $3,
           pausado_desde = CASE $4::text
             WHEN 'iniciar' THEN LOCALTIMESTAMP
             WHEN 'quitar'  THEN NULL
             ELSE pausado_desde END,
           fecha_resolucion = CASE $5::text
             WHEN 'iniciar' THEN LOCALTIMESTAMP
             WHEN 'quitar'  THEN NULL
             ELSE fecha_resolucion END,
           fecha_actualizacion = LOCALTIMESTAMP
       WHERE id = $6
       RETURNING ${COLUMNAS_CON_SLA}`,
      [nuevoEstado, nuevoEnEspera, minutosASumar, accionPausa, accionResolucion, id]
    );

    await client.query('COMMIT');

    res.json({
      mensaje: 'Estado del ticket actualizado',
      ticket: agregarInfoSla(result.rows[0])
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  getTickets,
  getTicketById,
  createTicket,
  updateTicketStatus
};