// Acceso a datos de la tabla tickets. Aquí vive TODO el SQL de tickets;
// las reglas de negocio están en services/ticket.service.js
const pool = require('../config/db');

// Columnas que se devuelven de cada ticket:
//  - todo el ticket + nombre del agente asignado
//  - minutos_sla: minutos consumidos, calculados en PostgreSQL en el momento:
//      (ahora o fecha de resolución) - fecha de creación - tiempo en pausa
//  - minutos_desde_creacion: para mostrar "Creado hace..." con el reloj de la BD
//  - escalado: true si el ticket ya venció y quedó en el historial de escalados
// Se usa LOCALTIMESTAMP porque las fechas se guardan como TIMESTAMP (sin zona horaria).
const SELECT_TICKET = `
  SELECT
    t.*,
    a.nombre AS agente_nombre,
    GREATEST(0,
      FLOOR(EXTRACT(EPOCH FROM (COALESCE(t.fecha_resolucion, LOCALTIMESTAMP) - t.fecha_creacion)) / 60)
      - COALESCE(t.minutos_pausados, 0)
      - CASE WHEN t.pausado_desde IS NOT NULL
          THEN FLOOR(EXTRACT(EPOCH FROM (COALESCE(t.fecha_resolucion, LOCALTIMESTAMP) - t.pausado_desde)) / 60)
          ELSE 0
        END
    )::int AS minutos_sla,
    FLOOR(EXTRACT(EPOCH FROM (LOCALTIMESTAMP - t.fecha_creacion)) / 60)::int AS minutos_desde_creacion,
    EXISTS (SELECT 1 FROM historial_escalados h WHERE h.ticket_id = t.id) AS escalado
  FROM tickets t
  LEFT JOIN agentes a ON a.id = t.agente_id
`;

async function listar() {
  const { rows } = await pool.query(`${SELECT_TICKET} ORDER BY t.fecha_creacion DESC`);
  return rows;
}

// Tickets que todavía cuentan tiempo de SLA (para el monitor en tiempo real)
async function listarActivos() {
  const { rows } = await pool.query(
    `${SELECT_TICKET} WHERE t.estado NOT IN ('Resuelto', 'Cerrado') ORDER BY t.id`
  );
  return rows;
}

// db puede ser el pool o el client de una transacción
async function buscarPorId(id, db = pool) {
  const { rows } = await db.query(`${SELECT_TICKET} WHERE t.id = $1`, [id]);
  return rows[0] || null;
}

async function crear({ titulo, descripcion, prioridad, agenteId, tiempoLimite }) {
  const { rows } = await pool.query(
    `INSERT INTO tickets (titulo, descripcion, prioridad, agente_id, tiempo_limite_resolucion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [titulo, descripcion, prioridad, agenteId, tiempoLimite]
  );
  return buscarPorId(rows[0].id);
}

// Lee el estado actual del ticket y BLOQUEA la fila hasta el fin de la transacción,
// para que dos actualizaciones simultáneas no se pisen
async function bloquearParaActualizar(client, id) {
  const { rows } = await client.query(
    `SELECT estado, en_espera, pausado_desde, fecha_resolucion, agente_id,
            FLOOR(EXTRACT(EPOCH FROM (LOCALTIMESTAMP - pausado_desde)) / 60)::int AS minutos_en_pausa,
            FLOOR(EXTRACT(EPOCH FROM (LOCALTIMESTAMP - fecha_resolucion)) / 60)::int AS minutos_resuelto
     FROM tickets WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] || null;
}

// accionPausa / accionResolucion: 'iniciar' (pone la hora actual), 'quitar' (NULL) o 'mantener'
async function actualizarEstado(client, id, { estado, enEspera, minutosASumar, accionPausa, accionResolucion }) {
  await client.query(
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
     WHERE id = $6`,
    [estado, enEspera, minutosASumar, accionPausa, accionResolucion, id]
  );
  return buscarPorId(id, client);
}

// Devuelve true si el ticket existía. Su historial de escalados se borra en cascada.
async function eliminar(id) {
  const { rowCount } = await pool.query('DELETE FROM tickets WHERE id = $1', [id]);
  return rowCount > 0;
}

// Borra todos los tickets y su historial; la numeración vuelve a empezar en 1
async function eliminarTodos() {
  await pool.query('TRUNCATE historial_escalados, tickets RESTART IDENTITY');
}

module.exports = {
  eliminar,
  eliminarTodos,
  listar,
  listarActivos,
  buscarPorId,
  crear,
  bloquearParaActualizar,
  actualizarEstado
};
