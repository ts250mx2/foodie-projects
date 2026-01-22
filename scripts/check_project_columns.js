const mysql = require('mysql2/promise');
const dbConfig = {
    host: 'hlsistemas.com',
    user: 'kyk',
    password: 'merkurio',
    database: 'BDFoodieProjects',
    port: 3306
};

async function checkColumns() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected!');

        const [rows] = await connection.query('DESCRIBE tblProyectos');
        console.log('Columns in tblProyectos:');
        rows.forEach(row => {
            console.log(`- ${row.Field} (${row.Type})`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

checkColumns();
