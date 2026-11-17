const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BackWeb API - Mesa de Ayuda con SLAs',
      version: '1.0.0',
      description: [
        'API REST para gestión de tickets, agentes y monitoreo de SLAs.',
        '',
        '**Cómo probar:** haz login en `POST /api/auth/login`, copia el `access_token`',
        'y pégalo en el botón **Authorize**. El refresh token queda en una cookie HttpOnly,',
        'así que `POST /api/auth/refresh` y `POST /api/auth/logout` funcionan sin cuerpo.',
        '',
        '**Tiempo real (Socket.io, mismo puerto):** el cliente se conecta enviando',
        '`auth: { token: <access_token> }` y recibe los eventos `ticket:creado`,',
        '`ticket:actualizado`, `sla:cambio` (cambio de color del semáforo) y',
        '`ticket:escalado` (el ticket venció y quedó en el historial).'
      ].join('\n')
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Servidor local'
      }
    ],
    // Botón "Authorize" en Swagger: pegas el access_token y se envía en cada petición
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Pega aquí el access_token que devuelve /api/auth/login'
        }
      }
    },
    // Por defecto todas las rutas exigen token (las públicas lo anulan con security: [])
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;