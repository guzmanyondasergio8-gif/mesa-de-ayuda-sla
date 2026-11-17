// Acceso a datos de la tabla refresh_tokens (solo se guarda el hash del token)
const pool = require('../config/db');

async function crear(agenteId, tokenHash, dias) {
  await pool.query(
    `INSERT INTO refresh_tokens (agente_id, token_hash, expira_en)
     VALUES ($1, $2, LOCALTIMESTAMP + make_interval(days => $3))`,
    [agenteId, tokenHash, dias]
  );
}

// Busca el token con los datos actuales del agente y BLOQUEA la fila,
// así dos renovaciones simultáneas con el mismo token no pueden ganar ambas
async function bloquearPorHash(client, tokenHash) {
  const { rows } = await client.query(
    `SELECT rt.id, rt.agente_id, rt.revocado, rt.expira_en < LOCALTIMESTAMP AS expirado,
            a.nombre, a.correo, a.rol
     FROM refresh_tokens rt
     JOIN agentes a ON a.id = rt.agente_id
     WHERE rt.token_hash = $1
     FOR UPDATE OF rt`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function revocar(client, id) {
  await client.query('UPDATE refresh_tokens SET revocado = TRUE WHERE id = $1', [id]);
}

async function revocarTodosDeAgente(agenteId) {
  await pool.query('UPDATE refresh_tokens SET revocado = TRUE WHERE agente_id = $1', [agenteId]);
}

async function eliminarPorHash(tokenHash) {
  await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
}

// Limpieza: borra tokens vencidos hace más de un día
async function eliminarExpirados() {
  await pool.query(`DELETE FROM refresh_tokens WHERE expira_en < LOCALTIMESTAMP - INTERVAL '1 day'`);
}

module.exports = {
  crear,
  bloquearPorHash,
  revocar,
  revocarTodosDeAgente,
  eliminarPorHash,
  eliminarExpirados
};
