
const mysql = require('mysql2/promise');

async function migrate() {
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
        console.log(`Migrating DB for project: ${project.Proyecto}`);

        projectConnection = await mysql.createConnection({
            host: project.Servidor,
            user: project.UsarioBD,
            password: project.PasswdBD,
            database: project.BaseDatos
        });

        console.log('Creating tblHorariosEmpleados...');
        await projectConnection.query(`
            CREATE TABLE IF NOT EXISTS tblHorariosEmpleados (
                IdHorarioEmpleado INT AUTO_INCREMENT PRIMARY KEY,
                IdEmpleado INT NOT NULL,
                Fecha DATE NOT NULL,
                HoraInicio TIME,
                HoraFin TIME,
                HoraInicioDescanso TIME,
                HoraFinDescanso TIME,
                FechaAct DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                Status INT DEFAULT 0,
                INDEX (IdEmpleado),
                INDEX (Fecha)
            )
        `);

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (mainConnection) await mainConnection.end();
        if (projectConnection) await projectConnection.end();
    }
}

migrate();
