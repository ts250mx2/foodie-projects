const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSchema() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'IntegraMembers.com',
        user: process.env.DB_USER || 'kyk',
        password: process.env.DB_PASSWORD || 'merkurio',
        database: 'BDFoodieProjects'
    });

    try {
        console.log('Checking columns in tblProductos...');
        const [columns] = await connection.query('DESCRIBE tblProductos');
        const columnNames = columns.map(c => c.Field);

        console.log('Existing columns:', columnNames);

        if (!columnNames.includes('CantidadCompra')) {
            console.log('Adding CantidadCompra column...');
            await connection.query('ALTER TABLE tblProductos ADD COLUMN CantidadCompra DECIMAL(18,4) DEFAULT 0');
        }

        if (!columnNames.includes('IdPresentacionInventario')) {
            console.log('Adding IdPresentacionInventario column...');
            await connection.query('ALTER TABLE tblProductos ADD COLUMN IdPresentacionInventario INT DEFAULT NULL');
        }

        console.log('Schema update completed.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

checkSchema();
