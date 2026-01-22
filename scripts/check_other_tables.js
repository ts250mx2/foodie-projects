const mysql = require('mysql2/promise');

async function checkOtherTables() {
    const mainConfig = {
        host: 'hlsistemas.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDFoodieProjects',
        port: 3306
    };

    let mainConnection;
    let projectConnection;

    try {
        console.log('Connecting to Main DB...');
        mainConnection = await mysql.createConnection(mainConfig);
        const [projects] = await mainConnection.query('SELECT * FROM tblProyectos LIMIT 1');
        const project = projects[0];
        console.log(`Checking DB for project: ${project.Proyecto}`);

        projectConnection = await mysql.createConnection({
            host: project.Servidor,
            user: project.UsarioBD,
            password: project.PasswdBD,
            database: project.BaseDatos
        });

        // Check tblTurnos
        try {
            const [colsTurnos] = await projectConnection.query('DESCRIBE tblTurnos');
            console.log('tblTurnos exists.');
        } catch (e) { console.log('tblTurnos missing'); }

        // Check tblPlataformas
        try {
            const [colsPlat] = await projectConnection.query('DESCRIBE tblPlataformas');
            console.log('tblPlataformas exists.');
        } catch (e) { console.log('tblPlataformas missing'); }

        // Check tblVentasTerminales
        try {
            const [colsVT] = await projectConnection.query('DESCRIBE tblVentasTerminales');
            console.log('tblVentasTerminales columns:');
            colsVT.forEach(c => console.log(`- ${c.Field} (${c.Type})`));
        } catch (e) { console.log('tblVentasTerminales missing'); }


    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (mainConnection) await mainConnection.end();
        if (projectConnection) await projectConnection.end();
    }
}

checkOtherTables();
