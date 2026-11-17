// Origen del Frontend. Con cookies (refresh token) CORS no permite '*',
// hay que indicar la dirección exacta del Frontend.
const ORIGEN_FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';

const opcionesCors = {
  origin: ORIGEN_FRONTEND,
  credentials: true // permite que el navegador envíe y reciba la cookie del refresh token
};

module.exports = { ORIGEN_FRONTEND, opcionesCors };
