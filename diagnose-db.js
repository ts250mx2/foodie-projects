const mysql = require('mysql2/promise');

async function diagnoseAndFix() {
    const mainConnection = await mysql.createConnection({
        host: 'IntegraMembers.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDFoodieProjects'
    });

    try {
        console.log('--- DIAGNOSIS START (BDFoodieProjects) ---');
        // Use EXACT column names found in BDFoodieProjects: UsarioBD, PasswdBD
        const [projects] = await mainConnection.query('SELECT IdProyecto, BaseDatos, Servidor, UsarioBD, PasswdBD FROM tblProyectos');

        console.log(`Checking ${projects.length} projects...`);

        for (const project of projects) {
            console.log(`\nAnalyzing Project ${project.IdProyecto}: ${project.BaseDatos} on ${project.Servidor}`);

            if (!project.BaseDatos || !project.Servidor) {
                console.log('  [SKIP] Missing connection info');
                continue;
            }

            let projectConn;
            try {
                projectConn = await mysql.createConnection({
                    host: project.Servidor,
                    user: project.UsarioBD,
                    password: project.PasswdBD,
                    database: project.BaseDatos
                });

                const [tables] = await projectConn.query("SHOW TABLES LIKE 'tblProductos'");
                if (tables.length === 0) {
                    console.log('  [SKIP] tblProductos not found');
                    continue;
                }

                const [columns] = await projectConn.query('DESCRIBE tblProductos');
                const columnNames = columns.map(c => c.Field);

                const hasQty = columnNames.includes('CantidadCompra');
                const hasPres = columnNames.includes('IdPresentacionInventario');

                console.log(`  Columns: Qty=${hasQty}, Pres=${hasPres}`);

                if (!hasQty) {
                    console.log('  [FIX] Adding CantidadCompra...');
                    await projectConn.query('ALTER TABLE tblProductos ADD COLUMN CantidadCompra DECIMAL(18,4) DEFAULT 0');
                }
                if (!hasPres) {
                    console.log('  [FIX] Adding IdPresentacionInventario...');
                    await projectConn.query('ALTER TABLE tblProductos ADD COLUMN IdPresentacionInventario INT DEFAULT NULL');
                }

                console.log('  [OK] Schema Verified');

            } catch (err) {
                console.error(`  [ERROR] ${err.message}`);
            } finally {
                if (projectConn) await projectConn.end();
            }
        }
        console.log('\n--- DIAGNOSIS COMPLETE ---');
    } catch (err) {
        console.error('FATAL ERROR:', err);
    } finally {
        await mainConnection.end();
    }
}

diagnoseAndFix();
