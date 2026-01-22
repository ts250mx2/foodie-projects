const mysql = require('mysql2/promise');

async function checkSchema() {
    const connection = await mysql.createConnection({
        host: '26.173.65.119',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDAngelesSoccer'
    });

    try {
        const [rows] = await connection.query("SHOW COLUMNS FROM tblUsuarios LIKE 'passwd'");
        console.log('Column Schema:', rows);

        const [funcRows] = await connection.query("SELECT passwd, LENGTH(passwd) as len FROM tblUsuarios ORDER BY IdUsuario DESC LIMIT 1");
        console.log('Last User Password:', funcRows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

checkSchema();
