// Configuración de Express: middlewares, rutas y manejo de errores.
// Está separada de index.js (que enciende el servidor) para poder usar la
// misma app en las pruebas de integración.
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { opcionesCors } = require('./config/cors');
const ticketRoutes = require('./routes/ticket.routes');
const catalogoRoutes = require('./routes/catalogo.routes');
const agenteRoutes = require('./routes/agente.routes');
const authRoutes = require('./routes/auth.routes');
const { verificarToken } = require('./middlewares/auth.middleware');
const { manejarErrores } = require('./utils/errores');

const app = express();

app.use(cors(opcionesCors));   // Permite peticiones del Frontend, con cookies
app.use(express.json());
app.use(cookieParser());       // Lee la cookie del refresh token

// Documentación de la API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rutas públicas: login, renovar sesión y cerrar sesión
app.use('/api/auth', authRoutes);

// Rutas protegidas: exigen el access token (Authorization: Bearer <token>)
app.use('/api/tickets', verificarToken, ticketRoutes);
app.use('/api/catalogos', verificarToken, catalogoRoutes);
app.use('/api/agentes', verificarToken, agenteRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API de Mesa de Ayuda lista', docs: '/api-docs' });
});

// Ruta inexistente
app.use((req, res) => {
  res.status(404).json({ error: `No existe la ruta ${req.method} ${req.originalUrl}` });
});

// Todos los errores terminan aquí y se responden con el mismo formato
app.use(manejarErrores);

module.exports = app;
