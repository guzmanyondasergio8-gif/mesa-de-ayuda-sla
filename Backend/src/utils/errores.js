// Error de negocio con su código HTTP. Los servicios lo lanzan y el
// manejador central lo convierte en la respuesta JSON { error, codigo? }.
class ErrorApp extends Error {
  constructor(status, mensaje, codigo) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

// Envuelve un controlador async para que sus errores lleguen al manejador central
const conManejo = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Middleware de Express que responde todos los errores con el mismo formato
// eslint-disable-next-line no-unused-vars
function manejarErrores(err, req, res, next) {
  // Errores de PostgreSQL que tienen una causa conocida
  if (err.code === '23503') {
    err = new ErrorApp(400, 'El agente indicado no existe.');
  } else if (err.code === '23505') {
    err = new ErrorApp(409, 'Ya existe un registro con ese valor.');
  } else if (err.type === 'entity.parse.failed') {
    err = new ErrorApp(400, 'El cuerpo de la petición no es un JSON válido.');
  }

  if (err instanceof ErrorApp) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.codigo ? { codigo: err.codigo } : {})
    });
  }

  console.error('Error inesperado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
}

module.exports = { ErrorApp, conManejo, manejarErrores };
