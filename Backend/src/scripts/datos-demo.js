// Carga datos de ejemplo para la presentación: agentes y tickets en todos los estados.
// Dos tickets quedan "programados" para cambiar de color EN VIVO mientras presentas:
//   - "Caída de la VPN" (Alta): pasa de verde a amarillo en ~1 minuto.
//   - "Servidor de facturación caído" (Crítica): pasa de amarillo a rojo en ~3 minutos
//     y el monitor lo escala automáticamente.
//
// Uso (desde la carpeta Backend, con PostgreSQL encendido):
//   npm run datos-demo                 -> agrega los tickets de ejemplo
//   npm run datos-demo -- --limpiar    -> BORRA todos los tickets antes de agregarlos
//
// Córrelo justo antes de presentar y luego enciende el backend con npm run dev.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const runMigrations = require('../config/migrate');
const { TIEMPOS_SLA_MINUTOS } = require('../services/sla.service');

const PASSWORD_DEMO = 'Clave123';

const AGENTES = [
  { nombre: 'María López', correo: 'maria@empresa.com' },
  { nombre: 'Juan Pérez', correo: 'juan@empresa.com' }
];

// minutosAtras = hace cuánto se creó; pausa = minutos que lleva en espera (desde hace)
const TICKETS = [
  { titulo: 'Servidor de facturación caído', descripcion: 'El sistema de facturación no responde desde la mañana.',
    prioridad: 'Crítica', agente: 'maria@empresa.com', minutosAtras: 27 },   // amarillo, vence en 3 min
  { titulo: 'Caída de la VPN', descripcion: 'Los usuarios remotos no logran conectarse a la VPN.',
    prioridad: 'Alta', agente: 'juan@empresa.com', minutosAtras: 89 },       // verde, amarillo en 1 min
  { titulo: 'Impresora de contabilidad atascada', descripcion: 'Muestra error de papel atascado sin tener papel adentro.',
    prioridad: 'Alta', agente: 'maria@empresa.com', minutosAtras: 100 },     // amarillo (20 min)
  { titulo: 'Usuario bloqueado en el ERP', descripcion: 'Cuenta bloqueada por intentos fallidos; se espera autorización del jefe.',
    prioridad: 'Media', agente: 'juan@empresa.com', minutosAtras: 520, estado: 'En Espera', pausadoHace: 120 }, // en pausa
  { titulo: 'Correo corporativo lento', descripcion: 'Outlook tarda varios minutos en sincronizar.',
    prioridad: 'Media', agente: null, minutosAtras: 540 },                     // vencido -> escalado
  { titulo: 'Instalar software de diseño', descripcion: 'Solicitud de instalación para el equipo de mercadeo.',
    prioridad: 'Baja', agente: null, minutosAtras: 60 },                       // verde
  { titulo: 'Mouse inalámbrico no conecta', descripcion: 'Se cambiaron las pilas y se reemparejó el receptor.',
    prioridad: 'Media', agente: 'juan@empresa.com', minutosAtras: 180, estado: 'Resuelto', resueltoHace: 120 } // resuelto
];

async function main() {
  const limpiar = process.argv.includes('--limpiar');
  await runMigrations();

  if (limpiar) {
    await pool.query('DELETE FROM tickets');          // el historial se borra en cascada
    console.log('Tickets anteriores eliminados.');
  }

  // Agentes de ejemplo (si ya existen, solo se les reinicia la contraseña)
  const hash = await bcrypt.hash(PASSWORD_DEMO, 10);
  const ids = {};
  for (const a of AGENTES) {
    const { rows } = await pool.query(
      `INSERT INTO agentes (nombre, correo, rol, password_hash)
       VALUES ($1, $2, 'Agente', $3)
       ON CONFLICT (correo) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [a.nombre, a.correo, hash]
    );
    ids[a.correo] = rows[0].id;
  }

  for (const t of TICKETS) {
    const pausado = t.estado === 'En Espera';
    const resuelto = t.estado === 'Resuelto';
    await pool.query(
      `INSERT INTO tickets (titulo, descripcion, prioridad, estado, agente_id, tiempo_limite_resolucion,
                            en_espera, pausado_desde, fecha_resolucion, fecha_creacion, fecha_actualizacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               CASE WHEN $7 THEN LOCALTIMESTAMP - make_interval(mins => $8) END,
               CASE WHEN $9 THEN LOCALTIMESTAMP - make_interval(mins => $10) END,
               LOCALTIMESTAMP - make_interval(mins => $11),
               LOCALTIMESTAMP)`,
      [
        t.titulo, t.descripcion, t.prioridad, t.estado || 'Abierto',
        t.agente ? ids[t.agente] : null, TIEMPOS_SLA_MINUTOS[t.prioridad],
        pausado, t.pausadoHace || 0,
        resuelto, t.resueltoHace || 0,
        t.minutosAtras
      ]
    );
  }

  console.log(`Listo: ${TICKETS.length} tickets de ejemplo.`);
  console.log(`Agentes de ejemplo (contraseña ${PASSWORD_DEMO}): ${AGENTES.map((a) => a.correo).join(', ')}`);
  console.log('Ahora enciende el backend (npm run dev). En unos minutos verás cambios de color en vivo.');
}

main()
  .catch((error) => {
    console.error('Error:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
