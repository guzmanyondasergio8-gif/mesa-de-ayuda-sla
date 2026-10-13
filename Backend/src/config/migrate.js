const pool = require('./db');

async function runMigrations() {
    try {
        // 1. Tabla de Agentes / Usuarios
        await pool.query(`
            CREATE TABLE IF NOT EXISTS agentes (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                correo VARCHAR(100) UNIQUE NOT NULL,
                rol VARCHAR(50) DEFAULT 'Agente'
            );
        `);

        // 2. Tabla de Tickets con soporte para SLAs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tickets (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(150) NOT NULL,
                descripcion TEXT NOT NULL,
                prioridad VARCHAR(20) NOT NULL,
                estado VARCHAR(30) DEFAULT 'Abierto',
                agente_id INT REFERENCES agentes(id) ON DELETE SET NULL,
                tiempo_limite_resolucion INT NOT NULL,
                tiempo_transcurrido_minutos INT DEFAULT 0,
                en_espera BOOLEAN DEFAULT FALSE,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. Tabla para el historial de escalados
        await pool.query(`
            CREATE TABLE IF NOT EXISTS historial_escalados (
                id SERIAL PRIMARY KEY,
                ticket_id INT REFERENCES tickets(id) ON DELETE CASCADE,
                motivo TEXT NOT NULL,
                fecha_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("Migraciones de Mesa de Ayuda y SLAs completadas con éxito.");
    } catch (error) {
        console.error("Error al ejecutar migraciones:", error.message || error);
        throw error;
    }
}

module.exports = runMigrations;