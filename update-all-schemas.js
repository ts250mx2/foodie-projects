const mysql = require('mysql2/promise');

async function updateAllProjectSchemas() {
    // 1. Connect to main DB (corrected name)
    const mainConnection = await mysql.createConnection({
        host: 'IntegraMembers.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDIntegraProjects'
    });

    try {
        console.log('Fetching projects from tblProyectos...');
        const [projects] = await mainConnection.query('SELECT IdProyecto, BaseDatos, Servidor, UsarioBD, PasswdBD FROM tblProyectos');

        console.log(`Found ${projects.length} projects.`);

        for (const project of projects) {
            console.log(`--- Updating Project ${project.IdProyecto} (${project.BaseDatos}) ---`);
            let projectConnection;
            try {
                // Some projects might have empty or invalid DB info, skip if so
                if (!project.BaseDatos || !project.Servidor) {
                    console.log('Skipping due to missing DB info.');
                    continue;
                }

                projectConnection = await mysql.createConnection({
                    host: project.Servidor,
                    user: project.UsarioBD,
                    password: project.PasswdBD,
                    database: project.BaseDatos
                });

                // Check if tblProductos exists in this database
                const [tables] = await projectConnection.query(`SHOW TABLES LIKE 'tblProductos'`);
                if (tables.length === 0) {
                    console.log('tblProductos does not exist in this database. Skipping.');
                    continue;
                }

                const [columns] = await projectConnection.query('DESCRIBE tblProductos');
                const columnNames = columns.map(c => c.Field);

                if (!columnNames.includes('CantidadCompra')) {
                    console.log('Adding CantidadCompra column...');
                    await projectConnection.query('ALTER TABLE tblProductos ADD COLUMN CantidadCompra DECIMAL(18,4) DEFAULT 0');
                } else {
                    console.log('CantidadCompra already exists.');
                }

                if (!columnNames.includes('IdPresentacionInventario')) {
                    console.log('Adding IdPresentacionInventario column...');
                    await projectConnection.query('ALTER TABLE tblProductos ADD COLUMN IdPresentacionInventario INT DEFAULT NULL');
                } else {
                    console.log('IdPresentacionInventario already exists.');
                }

                console.log(`Project ${project.IdProyecto} updated successfully.`);
            } catch (pErr) {
                console.error(`Error updating project ${project.IdProyecto} (${project.BaseDatos}):`, pErr.message);
            } finally {
                if (projectConnection) await projectConnection.end();
            }
        }

        console.log('All project schemas processed.');
    } catch (err) {
        console.error('Main Error:', err);
    } finally {
        await mainConnection.end();
    }
}

updateAllProjectSchemas();
