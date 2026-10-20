require('dotenv').config();
const express = require('express');
const cors = require('cors'); // <-- 1. Importar cors
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const runMigrations = require('./config/migrate');
const ticketRoutes = require('./routes/ticket.routes');
const catalogoRoutes = require('./routes/catalogo.routes');


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // <-- 2. Permitir peticiones desde el Frontend
app.use(express.json());

// Documentación de la API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rutas del sistema
app.use('/api/tickets', ticketRoutes);
app.use('/api/catalogos', catalogoRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API de Mesa de Ayuda lista', docs: '/api-docs' });
});

async function start() {
  try {
    await runMigrations();
    app.listen(PORT, () => {
      console.log(`Servidor en http://localhost:${PORT}`);
      console.log(`Swagger en  http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error("Error al iniciar:", error.message || error);
    process.exit(1);
  }
}

start();