const mysql = require('mysql2/promise');

async function checkProyectosSchema() {
    const mainConnection = await mysql.createConnection({
        host: 'IntegraMembers.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDFoodieProjects'
    });

    try {
        console.log('Checking columns in tblProyectos (BDFoodieProjects)...');
        const [columns] = await mainConnection.query('DESCRIBE tblProyectos');
        console.log('Columns:', columns.map(c => c.Field));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mainConnection.end();
    }
}

checkProyectosSchema();
