const mysql = require('mysql2/promise');

async function checkNominaSchema() {
    console.log('--- CHECKING NOMINA SCHEMA ---');
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

                const [tables] = await projectConn.query("SHOW TABLES LIKE 'tblNomina'");
                if (tables.length === 0) {
                    console.log('  [SKIP] tblNomina not found');
                    continue;
                }

                const [columns] = await projectConn.query('DESCRIBE tblNomina');
                console.log('  Columns:', columns.map(c => c.Field).join(', '));

                const [sample] = await projectConn.query('SELECT * FROM tblNomina LIMIT 5');
                console.log('  Sample Data:', sample);

                const [employees] = await projectConn.query('SELECT IdEmpleado, Empleado FROM tblEmpleados LIMIT 5');
                console.log('  Sample Employees:', employees);

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

checkNominaSchema();
