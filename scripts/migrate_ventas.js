const mysql = require('mysql2/promise');

async function migrateVentas() {
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
        const [projects] = await mainConnection.query('SELECT * FROM tblProyectos LIMIT 1'); // Assuming target is first project
        const project = projects[0];
        console.log(`Migrating DB for project: ${project.Proyecto}`);

        projectConnection = await mysql.createConnection({
            host: project.Servidor,
            user: project.UsarioBD,
            password: project.PasswdBD,
            database: project.BaseDatos,
            multipleStatements: true
        });

        // 1. Check if column exists to avoid error
        const [cols] = await projectConnection.query("SHOW COLUMNS FROM `tblVentas` LIKE 'IdTerminal'");
        if (cols.length > 0) {
            console.log('IdTerminal already exists in tblVentas.');
            return;
        }

        // 2. Add column
        console.log('Adding IdTerminal column...');
        await projectConnection.query("ALTER TABLE `tblVentas` ADD COLUMN `IdTerminal` INT NOT NULL DEFAULT 0 AFTER `IdTurno`");

        // 3. Update Primary Key
        console.log('Updating Primary Key...');
        // Need to drop old PK first. 
        // Note: 'DROP PRIMARY KEY' works in MySQL.
        await projectConnection.query("ALTER TABLE `tblVentas` DROP PRIMARY KEY, ADD PRIMARY KEY (`Dia`, `Mes`, `Anio`, `IdTurno`, `IdPlataforma`, `IdTerminal`, `IdSucursal`)");

        console.log('Migration successful.');

    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        if (mainConnection) await mainConnection.end();
        if (projectConnection) await projectConnection.end();
    }
}

migrateVentas();
