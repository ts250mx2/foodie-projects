const mysql = require('mysql2/promise');

async function checkData() {
    console.log('--- STARTING DIAGNOSIS ---');
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

                const [branches] = await projectConn.query('SELECT IdSucursal, Sucursal FROM tblSucursales WHERE Status = 0');
                console.log(`  Branches: ${branches.map(b => `${b.Sucursal} (${b.IdSucursal})`).join(', ') || 'None'}`);

                const [employees] = await projectConn.query('SELECT IdEmpleado, Empleado, IdSucursal, Status FROM tblEmpleados');
                console.log(`  Employees Total: ${employees.length}`);

                const stats = employees.reduce((acc, emp) => {
                    const statusKey = emp.Status === 0 ? 'Active' : 'Inactive';
                    acc[statusKey] = (acc[statusKey] || 0) + 1;
                    if (emp.Status === 0) {
                        acc['ActiveWithBranch'] = (acc['ActiveWithBranch'] || 0) + (emp.IdSucursal ? 1 : 0);
                        acc['ActiveWithoutBranch'] = (acc['ActiveWithoutBranch'] || 0) + (emp.IdSucursal ? 0 : 1);
                    }
                    return acc;
                }, {});
                console.log('  Stats:', stats);

                if (employees.length > 0) {
                    console.log('  Sample (Active):', employees.filter(e => e.Status === 0).slice(0, 3));
                }

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
    console.log('\n--- DIAGNOSIS COMPLETE ---');
}

checkData();
