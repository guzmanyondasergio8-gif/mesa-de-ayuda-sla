const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on('error', (err) => {
  console.error('Error en el pool de PostgreSQL:', err);
});

// Ejecuta varias consultas como una sola transacción.
// Si la función lanza un error, se hace ROLLBACK y no queda nada a medias.
// Uso: await conTransaccion(async (client) => { await client.query(...) })
async function conTransaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = pool;
module.exports.conTransaccion = conTransaccion;
