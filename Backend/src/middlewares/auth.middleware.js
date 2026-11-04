const jwt = require('jsonwebtoken');

// Verifica el access token que llega en el header:  Authorization: Bearer <token>
// Si es válido, deja los datos del agente en req.usuario = { id, nombre, rol }
// El campo "codigo" le dice al Frontend qué hacer:
//   TOKEN_EXPIRADO -> renovar con el refresh token y repetir la petición
//   TOKEN_NO_ENVIADO / TOKEN_INVALIDO -> mandar al login
function verificarToken(req, res, next) {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({
      error: 'Debes iniciar sesión para usar este recurso.',
      codigo: 'TOKEN_NO_ENVIADO'
    });
  }

  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { id: datos.sub, nombre: datos.nombre, rol: datos.rol };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'La sesión expiró. Renueva el token.',
        codigo: 'TOKEN_EXPIRADO'
      });
    }
    return res.status(401).json({
      error: 'Token inválido.',
      codigo: 'TOKEN_INVALIDO'
    });
  }
}

// Permite el paso solo a los roles indicados. Se usa DESPUÉS de verificarToken.
// Ejemplo: router.post('/', permitirRoles('Administrador'), createAgente)
function permitirRoles(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({
        error: `No tienes permiso para esta acción. Requiere rol: ${roles.join(' o ')}.`
      });
    }
    next();
  };
}

module.exports = { verificarToken, permitirRoles };
