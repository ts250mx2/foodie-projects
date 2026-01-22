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

        console.log('Adding VerificationToken column...');
        // Using a safe query that doesn't fail if column exists (MySQL 8.0.29+ supports IF NOT EXISTS in ALTER TABLE ADD COLUMN, 
        // but for older versions we might need a stored procedure or just catch the error. 
        // Simplest way for general MySQL compatibility is to try and ignore "Duplicate column name" error code 1060).

        try {
            await connection.query('ALTER TABLE tblUsuarios ADD COLUMN VerificationToken VARCHAR(255) NULL');
            console.log('Column VerificationToken added successfully.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Column VerificationToken already exists.');
            } else {
                throw err;
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
