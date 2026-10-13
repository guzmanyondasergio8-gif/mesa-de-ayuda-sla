const pool = require('../config/db');

// Tiempos límites del SLA en minutos según prioridad
const TIEMPOS_SLA_MINUTOS = {
  Baja: 1440,    // 24 horas
  Media: 480,    // 8 horas
  Alta: 120,     // 2 horas
  Critica: 30    // 30 minutos
};

// 1. Listar todos los tickets
const getTickets = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tickets ORDER BY fecha_creacion DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Crear un nuevo ticket con calculo inicial de SLA
const createTicket = async (req, res) => {
  const { titulo, descripcion, prioridad, agente_id } = req.body;

  if (!titulo || !descripcion || !prioridad) {
    return res.status(400).json({ error: 'Título, descripción y prioridad son obligatorios.' });
  }

  const tiempoLimite = TIEMPOS_SLA_MINUTOS[prioridad] || 480;

  try {
    const result = await pool.query(
      `INSERT INTO tickets (titulo, descripcion, prioridad, agente_id, tiempo_limite_resolucion)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [titulo, descripcion, prioridad, agente_id || null, tiempoLimite]
    );

    res.status(201).json({
      mensaje: 'Ticket creado con éxito',
      ticket: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getTickets,
  createTicket
};