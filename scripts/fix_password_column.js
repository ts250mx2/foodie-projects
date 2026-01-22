const mysql = require('mysql2/promise');

async function fixSchema() {
    const connection = await mysql.createConnection({
        host: 'hlsistemas.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDFoodieProjects'
    });

    try {
        console.log('Altering tblUsuarios to increase passwd column length per bcrypt requirements...');
        await connection.query("ALTER TABLE tblUsuarios MODIFY COLUMN passwd VARCHAR(255)");
        console.log('Successfully altered passwd column to VARCHAR(255).');
    } catch (error) {
        console.error('Error altering table:', error);
    } finally {
        await connection.end();
    }
}

fixSchema();
