const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../../../.env.local') });

async function checkTable() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'BDFoodieProjects'
    });

    try {
        const [rows] = await connection.query("SHOW TABLES LIKE 'tblOCRQRTransfer'");
        console.log('Tables matching tblOCRQRTransfer:', rows.length);
        if (rows.length === 0) {
            console.log('Table does not exist. Creating it...');
            await connection.query(`
                CREATE TABLE tblOCRQRTransfer (
                    Id INT AUTO_INCREMENT PRIMARY KEY,
                    SessionId VARCHAR(100) NOT NULL UNIQUE,
                    ImageBase64 MEDIUMTEXT NULL,
                    Status INT DEFAULT 0,
                    FechaAlt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('Table created.');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

checkTable();
