const mysql = require('mysql2/promise');

async function run() {
    const mainPool = mysql.createPool({
        host: 'integramembers.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDFoodieProjects'
    });

    try {
        const [projects] = await mainPool.query('SELECT * FROM tblProyectos WHERE IdProyecto = 7');
        const project = projects[0];
        const dbUser = project.UsuarioBD || project.UsarioBD;
        const dbPass = project.PasswordBD || project.PasswdBD;

        const connection = await mysql.createConnection({
            host: project.Servidor,
            user: dbUser,
            password: dbPass,
            database: project.BaseDatos
        });

        const [rows] = await connection.query("DESCRIBE vlPlatillos");
        console.log(JSON.stringify(rows));
        await connection.end();
    } catch (e) {
        console.error(e);
    } finally {
        await mainPool.end();
        process.exit(0);
    }
}
run();
