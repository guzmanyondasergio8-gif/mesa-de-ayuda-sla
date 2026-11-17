// Crea un administrador desde la terminal (o convierte en administrador a uno existente).
// Hace falta porque crear agentes desde la API exige ser Administrador.
//
// Uso (desde la carpeta Backend):
//   npm run crear-admin -- "Nombre Apellido" correo@empresa.com Clave123
require('dotenv').config();
const pool = require('../config/db');
const runMigrations = require('../config/migrate');
const agenteService = require('../services/agente.service');

async function main() {
  const [nombre, correo, password] = process.argv.slice(2);

  if (!nombre || !correo || !password) {
    console.log('Uso: npm run crear-admin -- "Nombre Apellido" correo@empresa.com Clave123');
    process.exitCode = 1;
    return;
  }

  await runMigrations();
  const agente = await agenteService.crearOActualizarAdmin({ nombre, correo, password });
  console.log('Administrador listo:', agente);
}

main()
  .catch((error) => {
    console.error('Error:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
