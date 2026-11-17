// Tiempo real con Socket.io.
// Los navegadores se conectan enviando su access token; si no es válido, se rechaza.
// Todo lo que los servicios publican en el bus de eventos se reenvía a los conectados.
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { eventos, EVENTOS } = require('../services/eventos');
const { ORIGEN_FRONTEND } = require('../config/cors');

let io = null;

function iniciarSockets(servidorHttp) {
  io = new Server(servidorHttp, {
    cors: { origin: ORIGEN_FRONTEND, credentials: true }
  });

  // Autenticación del socket con el mismo JWT de la API
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('TOKEN_NO_ENVIADO'));
    try {
      const datos = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.usuario = { id: datos.sub, nombre: datos.nombre, rol: datos.rol };
      next();
    } catch (error) {
      next(new Error(error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.data.usuario.nombre} (${io.engine.clientsCount} en línea)`);
    socket.on('disconnect', () => {
      console.log(`Socket desconectado: ${socket.data.usuario.nombre}`);
    });
  });

  // Reenviar a todos los navegadores lo que pasa en el backend
  for (const nombre of Object.values(EVENTOS)) {
    eventos.on(nombre, (datos) => io.emit(nombre, datos));
  }

  return io;
}

module.exports = { iniciarSockets };
