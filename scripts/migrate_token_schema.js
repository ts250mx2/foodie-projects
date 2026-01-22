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

        console.log('Adding VerificationToken column to tblProyectosUsuarios...');
        try {
            await connection.query('ALTER TABLE tblProyectosUsuarios ADD COLUMN VerificationToken VARCHAR(255) NULL');
            console.log('Column VerificationToken added to tblProyectosUsuarios successfully.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Column VerificationToken already exists in tblProyectosUsuarios.');
            } else {
                console.error('Error adding column to tblProyectosUsuarios:', err);
            }
        }

        console.log('Dropping VerificationToken column from tblUsuarios...');
        try {
            await connection.query('ALTER TABLE tblUsuarios DROP COLUMN VerificationToken');
            console.log('Column VerificationToken dropped from tblUsuarios successfully.');
        } catch (err) {
            if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                console.log('Column VerificationToken does not exist in tblUsuarios.');
            } else {
                console.error('Error dropping column from tblUsuarios:', err);
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
