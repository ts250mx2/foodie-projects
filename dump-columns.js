const mysql = require('mysql2/promise');

async function dumpColumns() {
    // Connect to PROJECT 7 (FG_Pollos_Medina) which already had columns
    // Use the main DB to get connection info
    const mainConnection = await mysql.createConnection({
        host: 'IntegraMembers.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDFoodieProjects'
    });

    try {
        const [projects] = await mainConnection.query('SELECT BaseDatos, Servidor, UsarioBD, PasswdBD FROM tblProyectos WHERE IdProyecto = 7');
        const project = projects[0];

        const projectConn = await mysql.createConnection({
            host: project.Servidor,
            user: project.UsarioBD,
            password: project.PasswdBD,
            database: project.BaseDatos
        });

        const [columns] = await projectConn.query('DESCRIBE tblProductos');
        console.log('Project 7 tblProductos Columns:');
        columns.forEach(c => console.log(`- ${c.Field} (${c.Type})`));

        await projectConn.end();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mainConnection.end();
    }
}

dumpColumns();
