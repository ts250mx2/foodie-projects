const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: 'BDFoodieProjects' // Or maybe BDFoodiProjects
        });
        const [rows] = await conn.query('DESCRIBE tblCategorias');
        console.log("tblCategorias structure:", rows);
        await conn.end();
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
