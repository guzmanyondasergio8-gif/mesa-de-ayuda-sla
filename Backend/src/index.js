// Punto de entrada: corre las migraciones y enciende la API, Socket.io y el monitor del SLA.
// La configuración de Express (rutas, middlewares) está en app.js.
require('dotenv').config();
const http = require('http');
const app = require('./app');
const runMigrations = require('./config/migrate');
const { ORIGEN_FRONTEND } = require('./config/cors');
const { iniciarSockets } = require('./sockets');
const monitorSla = require('./services/monitorSla.service');

const PORT = process.env.PORT || 4000;

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('Falta JWT_SECRET en el archivo .env (necesario para el login).');
    process.exit(1);
  }

  try {
    await runMigrations();

    // Express y Socket.io comparten el mismo servidor y puerto
    const servidor = http.createServer(app);
    iniciarSockets(servidor);

    servidor.listen(PORT, () => {
      console.log(`Servidor en http://localhost:${PORT}`);
      console.log(`Swagger en  http://localhost:${PORT}/api-docs`);
      console.log(`Frontend permitido: ${ORIGEN_FRONTEND}`);
      monitorSla.iniciar();
    });
  } catch (error) {
    console.error('Error al iniciar:', error.message || error);
    process.exit(1);
  }
}

start();
