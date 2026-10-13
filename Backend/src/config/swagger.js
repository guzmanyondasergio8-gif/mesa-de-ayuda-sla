const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BackWeb API - Mesa de Ayuda con SLAs',
      version: '1.0.0',
      description: 'API REST para gestión de tickets, agentes y monitoreo de SLAs'
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Servidor local'
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;