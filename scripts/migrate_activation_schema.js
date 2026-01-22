const mysql = require('mysql2/promise');

async function migrate() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'hlsistemas.com',
        user: process.env.DB_USER || 'kyk',
        password: process.env.DB_PASSWORD || 'merkurio',
        database: process.env.DB_NAME || 'BDFoodieProjects',
        port: Number(process.env.DB_PORT) || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    });

    try {
        console.log('Connecting to database...');
        const connection = await pool.getConnection();
        console.log('Connected.');

        console.log('Adding activation columns to tblProyectosUsuarios...');

        // Add CuentaActiva
        try {
            await connection.query('ALTER TABLE tblProyectosUsuarios ADD COLUMN CuentaActiva TINYINT DEFAULT 0');
            console.log('Column CuentaActiva added successfully.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Column CuentaActiva already exists.');
            } else {
                console.error('Error adding CuentaActiva:', err);
            }
        }

        // Add FechaActivacion
        try {
            await connection.query('ALTER TABLE tblProyectosUsuarios ADD COLUMN FechaActivacion DATETIME NULL');
            console.log('Column FechaActivacion added successfully.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Column FechaActivacion already exists.');
            } else {
                console.error('Error adding FechaActivacion:', err);
            }
        }

        connection.release();
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
