const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function checkDb() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log("Conectando a:", process.env.DB_NAME);
        const [tables] = await pool.execute("SHOW TABLES");
        console.log("Tablas encontradas:", tables.map(t => Object.values(t)[0]));

        const [products] = await pool.execute("SELECT COUNT(*) as total FROM tblProductos");
        console.log("Total productos en tblProductos:", products[0].total);

        process.exit(0);
    } catch (err) {
        console.error("Error checking DB:", err.message);
        process.exit(1);
    }
}

checkDb();
