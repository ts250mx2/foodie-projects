const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'hlsistemas.com',
        user: process.env.DB_USER || 'kyk',
        password: process.env.DB_PASSWORD || 'merkurio',
        database: process.env.DB_NAME || 'BDFoodieProjects',
        port: Number(process.env.DB_PORT) || 3306,
    });

    try {
        console.log('Adding password reset columns to tblUsuarios...');

        // check if columns exist
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tblUsuarios' AND COLUMN_NAME IN ('ResetPasswordToken', 'ResetPasswordExpires')
        `, [process.env.DB_NAME || 'BDFoodieProjects']);

        const existingColumns = columns.map(c => c.COLUMN_NAME);

        if (!existingColumns.includes('ResetPasswordToken')) {
            await connection.query('ALTER TABLE tblUsuarios ADD COLUMN ResetPasswordToken VARCHAR(255) NULL, ADD INDEX (ResetPasswordToken)');
            console.log('Added ResetPasswordToken column.');
        } else {
            console.log('ResetPasswordToken column already exists.');
        }

        if (!existingColumns.includes('ResetPasswordExpires')) {
            await connection.query('ALTER TABLE tblUsuarios ADD COLUMN ResetPasswordExpires DATETIME NULL');
            console.log('Added ResetPasswordExpires column.');
        } else {
            console.log('ResetPasswordExpires column already exists.');
        }

        console.log('Migration complete.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
