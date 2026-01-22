const mysql = require('mysql2/promise');

// We need to query the project-specific DB, but I don't have the project credentials in plain text easily accessible 
// without querying tblProyectos first. 
// However, the user is likely using the ID 1 or similar for testing.
// I'll reuse the logic from check_project_columns but for a specific project if possible, 
// OR just query tblProyectos first to get creds, then query the target DB.

async function checkVentasSchema() {
    const mainConfig = {
        host: 'hlsistemas.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDFoodieProjects', // Main DB
        port: 3306
    };

    let mainConnection;
    let projectConnection;

    try {
        console.log('Connecting to Main DB...');
        mainConnection = await mysql.createConnection(mainConfig);

        // Get first project creds (assuming user is on this one)
        const [projects] = await mainConnection.query('SELECT * FROM tblProyectos LIMIT 1');
        if (projects.length === 0) {
            console.log('No projects found.');
            return;
        }
        const project = projects[0];
        console.log(`Checking DB for project: ${project.Proyecto} (${project.BaseDatos})`);

        projectConnection = await mysql.createConnection({
            host: project.Servidor,
            user: project.UsarioBD, // Note the typo from before
            password: project.PasswdBD,
            database: project.BaseDatos
        });

        const [columns] = await projectConnection.query('DESCRIBE tblVentas');
        console.log('Columns in tblVentas:');
        columns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (mainConnection) await mainConnection.end();
        if (projectConnection) await projectConnection.end();
    }
}

checkVentasSchema();
