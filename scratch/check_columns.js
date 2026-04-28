const mysql = require('mysql2/promise');
const fs = require('fs');

async function check() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '', // Defaulting to common local dev
            database: 'foodie_projects_1' // Guessing based on projectId 1
        });
        const [rows] = await connection.query('SHOW COLUMNS FROM tblCompras');
        console.log(JSON.stringify(rows, null, 2));
        await connection.end();
    } catch (e) {
        console.error(e.message);
    }
}
check();
