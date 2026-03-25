const mysql = require('mysql2/promise');

async function query() {
    console.log('Connecting...');
    const pool = mysql.createPool({
        host: 'integramembers.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDFoodieProjects',
        port: 3306,
        connectTimeout: 10000
    });

    try {
        const [rows] = await pool.query('SELECT * FROM tblProyectos LIMIT 10');
        console.log('RESULT:' + JSON.stringify(rows));
    } catch (error) {
        console.error('ERROR:' + error.message);
    } finally {
        await pool.end();
        console.log('Done.');
    }
}

query();
