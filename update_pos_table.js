const mysql = require('mysql2/promise');

async function run() {
    const mainPool = mysql.createPool({
        host: 'integramembers.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDFoodieProjects'
    });

    try {
        const [projects] = await mainPool.query('SELECT * FROM tblProyectos');
        
        for (const project of projects) {
            console.log(`Updating project: ${project.Proyecto} (${project.IdProyecto})`);
            const dbUser = project.UsuarioBD || project.UsarioBD;
            const dbPass = project.PasswordBD || project.PasswdBD;

            let connection;
            try {
                connection = await mysql.createConnection({
                    host: project.Servidor,
                    user: dbUser,
                    password: dbPass,
                    database: project.BaseDatos
                });

                // Check if IdProducto exists
                const [columns] = await connection.query(`SHOW COLUMNS FROM tblVentasPOS LIKE 'IdProducto'`);
                if (columns.length === 0) {
                    await connection.query(`ALTER TABLE tblVentasPOS ADD COLUMN IdProducto int DEFAULT NULL AFTER IdVentaPOS`);
                    console.log(`  Column IdProducto added.`);
                } else {
                    console.log(`  Column IdProducto already exists.`);
                }
            } catch (err) {
                console.error(`  Error in project ${project.IdProyecto}: ${err.message}`);
            } finally {
                if (connection) await connection.end();
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mainPool.end();
        process.exit(0);
    }
}
run();
