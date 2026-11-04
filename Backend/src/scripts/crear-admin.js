// Crea un administrador desde la terminal (o convierte en administrador a uno existente).
// Hace falta porque crear agentes desde la API ahora exige ser Administrador.
//
// Uso (desde la carpeta Backend):
//   npm run crear-admin -- "Nombre Apellido" correo@empresa.com Clave123
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const runMigrations = require('../config/migrate');

async function main() {
  const [nombre, correo, password] = process.argv.slice(2);

  if (!nombre || !correo || !password) {
    console.log('Uso: npm run crear-admin -- "Nombre Apellido" correo@empresa.com Clave123');
    process.exit(1);
  }
  if (password.length < 6) {
    console.log('La contraseña debe tener al menos 6 caracteres.');
    process.exit(1);
  }

  await runMigrations();

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO agentes (nombre, correo, rol, password_hash)
     VALUES ($1, $2, 'Administrador', $3)
     ON CONFLICT (correo) DO UPDATE
       SET nombre = EXCLUDED.nombre,
           rol = 'Administrador',
           password_hash = EXCLUDED.password_hash
     RETURNING id, nombre, correo, rol`,
    [nombre.trim(), correo.trim().toLowerCase(), passwordHash]
  );

  console.log('Administrador listo:', rows[0]);
}

main()
  .catch((error) => {
    console.error('Error:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
