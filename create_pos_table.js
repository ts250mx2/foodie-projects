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
            console.log(`Checking project: ${project.Proyecto} (${project.IdProyecto})`);
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

                await connection.query(`
                    CREATE TABLE IF NOT EXISTS tblVentasPOS (
                        IdVentaPOS int NOT NULL AUTO_INCREMENT,
                        IdSucursal int NOT NULL,
                        Dia int NOT NULL,
                        Mes int NOT NULL,
                        Anio int NOT NULL,
                        Codigo varchar(100) DEFAULT NULL,
                        Descripcion varchar(500) DEFAULT NULL,
                        Categoria varchar(200) DEFAULT NULL,
                        Cantidad decimal(10,2) DEFAULT 0,
                        PrecioUnitario decimal(10,2) DEFAULT 0,
                        Total decimal(10,2) DEFAULT 0,
                        FechaAct datetime DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (IdVentaPOS),
                        KEY idx_date_branch (Anio, Mes, Dia, IdSucursal)
                    ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
                `);
                console.log(`  Table created/verified.`);
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
