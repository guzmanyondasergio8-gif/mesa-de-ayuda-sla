// Borra TODOS los tickets (y su historial de escalados) para dejar el dashboard limpio.
// Los agentes y sus contraseñas no se tocan.
//
// Uso (desde la carpeta Backend):
//   npm run limpiar-tickets
require('dotenv').config();
const pool = require('../config/db');

async function main() {
  // RESTART IDENTITY reinicia la numeración: el próximo ticket será el #1
  await pool.query('TRUNCATE historial_escalados, tickets RESTART IDENTITY');
  console.log('Listo: se borraron todos los tickets. El dashboard quedó limpio.');
}

main()
  .catch((error) => {
    console.error('Error:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
