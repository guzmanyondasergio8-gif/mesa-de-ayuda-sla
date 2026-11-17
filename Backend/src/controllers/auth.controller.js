// Controlador de autenticación.
// El access token va en el JSON (el Frontend lo guarda en memoria) y el
// refresh token en una cookie HttpOnly que el JavaScript de la página no puede leer.
const authService = require('../services/auth.service');
const { conManejo } = require('../utils/errores');

const COOKIE_REFRESH = 'refresh_token';

const opcionesCookie = {
  httpOnly: true,                                   // invisible para JavaScript (protege de XSS)
  sameSite: 'strict',                               // no se envía desde otros sitios (protege de CSRF)
  secure: process.env.NODE_ENV === 'production',    // en producción, solo por HTTPS
  path: '/api/auth'                                 // solo viaja a las rutas de autenticación
};

// Responde la sesión: refresh token en la cookie, el resto en el JSON
function enviarSesion(res, sesion) {
  res.cookie(COOKIE_REFRESH, sesion.refreshToken, {
    ...opcionesCookie,
    maxAge: authService.REFRESH_TOKEN_DIAS * 24 * 60 * 60 * 1000
  });
  res.json({
    access_token: sesion.accessToken,
    token_type: 'Bearer',
    expires_in: sesion.expiresIn,
    agente: sesion.agente
  });
}

// POST /api/auth/login
const login = conManejo(async (req, res) => {
  const sesion = await authService.login(req.body.correo, req.body.password);
  enviarSesion(res, sesion);
});

// POST /api/auth/refresh — usa la cookie para entregar un access token nuevo
const refresh = conManejo(async (req, res) => {
  try {
    const sesion = await authService.renovarSesion(req.cookies[COOKIE_REFRESH]);
    enviarSesion(res, sesion);
  } catch (error) {
    // Si la sesión ya no sirve, se borra la cookie para no seguir intentando
    res.clearCookie(COOKIE_REFRESH, opcionesCookie);
    throw error;
  }
});

// POST /api/auth/logout — elimina el refresh token y borra la cookie
const logout = conManejo(async (req, res) => {
  await authService.cerrarSesion(req.cookies[COOKIE_REFRESH]);
  res.clearCookie(COOKIE_REFRESH, opcionesCookie);
  res.json({ mensaje: 'Sesión cerrada' });
});

// GET /api/auth/perfil — datos del agente dueño del token (ruta protegida)
const perfil = conManejo(async (req, res) => {
  res.json(await authService.perfil(req.usuario.id));
});

module.exports = { login, refresh, logout, perfil };
