const mysql = require('mysql2/promise');

async function checkKeys() {
    console.log('--- CHECKING NOMINA KEYS ---');
    let mainConnection;
    try {
        mainConnection = await mysql.createConnection({
            host: 'IntegraMembers.com',
            user: 'kyk',
            password: 'merkurio',
            database: 'BDFoodieProjects'
        });

        const [projects] = await mainConnection.query('SELECT IdProyecto, BaseDatos, Servidor, UsarioBD, PasswdBD FROM tblProyectos');

        for (const project of projects) {
            console.log(`\nProject ${project.IdProyecto}: ${project.BaseDatos}`);
            let projectConn;
            try {
                projectConn = await mysql.createConnection({
                    host: project.Servidor,
                    user: project.UsarioBD,
                    password: project.PasswdBD,
                    database: project.BaseDatos
                });

                const [keys] = await projectConn.query(`SHOW INDEX FROM tblNomina`);
                console.log('  Keys:', keys.map(k => `${k.Key_name}: ${k.Column_name}`).join(', '));

            } catch (err) {
                console.error(`  [ERROR] Project ${project.IdProyecto}: ${err.message}`);
            } finally {
                if (projectConn) await projectConn.end();
            }
        }
    } catch (err) {
        console.error('FATAL ERROR:', err);
    } finally {
        if (mainConnection) await mainConnection.end();
    }
}

checkKeys();
