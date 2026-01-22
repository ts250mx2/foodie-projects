
const mysql = require('mysql2/promise');

async function checkSchema() {
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

        const [tables] = await projectConnection.query('SHOW TABLES');
        console.log('Tables in database:', tables.map(t => Object.values(t)[0]));

        const [horariosSchema] = await projectConnection.query('DESCRIBE tblHorariosEmpleados').catch(() => [[]]);
        if (horariosSchema.length > 0) {
            console.log('Schema for tblHorariosEmpleados:');
            horariosSchema.forEach(c => console.log(`- ${c.Field} (${c.Type})`));
        } else {
            console.log('tblHorariosEmpleados does not exist.');
        }

        const [empleadosSchema] = await projectConnection.query('DESCRIBE tblEmpleados').catch(() => [[]]);
        console.log('Schema for tblEmpleados:');
        empleadosSchema.forEach(c => console.log(`- ${c.Field} (${c.Type})`));

        const [puestosSchema] = await projectConnection.query('DESCRIBE tblPuestos').catch(() => [[]]);
        console.log('Schema for tblPuestos:');
        puestosSchema.forEach(c => console.log(`- ${c.Field} (${c.Type})`));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (mainConnection) await mainConnection.end();
        if (projectConnection) await projectConnection.end();
    }
}

checkSchema();
