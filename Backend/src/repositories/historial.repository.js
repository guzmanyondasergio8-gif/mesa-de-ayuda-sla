// Acceso a datos de la tabla historial_escalados
const pool = require('../config/db');

async function registrar(ticketId, motivo) {
  const { rows } = await pool.query(
    `INSERT INTO historial_escalados (ticket_id, motivo)
     VALUES ($1, $2)
     RETURNING id, ticket_id, motivo, fecha_evento`,
    [ticketId, motivo]
  );
  return rows[0];
}

async function listarPorTicket(ticketId) {
  const { rows } = await pool.query(
    `SELECT id, ticket_id, motivo, fecha_evento
     FROM historial_escalados WHERE ticket_id = $1
     ORDER BY fecha_evento DESC`,
    [ticketId]
  );
  return rows;
}

module.exports = { registrar, listarPorTicket };
