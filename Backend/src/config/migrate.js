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

// 2.1 Columnas para pausar el reloj del SLA y registrar la resolución
        //     (ADD COLUMN IF NOT EXISTS no afecta bases que ya las tengan)
        await pool.query(`
            ALTER TABLE tickets
                ADD COLUMN IF NOT EXISTS pausado_desde TIMESTAMP NULL,
                ADD COLUMN IF NOT EXISTS minutos_pausados INT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS fecha_resolucion TIMESTAMP NULL;
        `);

        // 2.2 Contraseña de los agentes (encriptada con bcrypt) para el login
        await pool.query(`
            ALTER TABLE agentes
                ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;
        `);

        // 2.3 Refresh tokens emitidos (se guarda solo el hash, nunca el token)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id SERIAL PRIMARY KEY,
                agente_id INT NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
                token_hash VARCHAR(64) UNIQUE NOT NULL,
                expira_en TIMESTAMP NOT NULL,
                revocado BOOLEAN DEFAULT FALSE,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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