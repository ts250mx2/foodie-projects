const mysql = require('mysql2/promise');

async function run() {
    const mainPool = mysql.createPool({
        host: 'integramembers.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDFoodieProjects'
    });

    try {
        const [projects] = await mainPool.query('SELECT * FROM tblProyectos WHERE IdProyecto = 1');
        const project = projects[0];
        const dbUser = project.UsuarioBD || project.UsarioBD;
        const dbPass = project.PasswordBD || project.PasswdBD;

        const connection = await mysql.createConnection({
            host: project.Servidor,
            user: dbUser,
            password: dbPass,
            database: project.BaseDatos
        });

        const [tables] = await connection.query('SHOW TABLES');
        console.log(JSON.stringify(tables));
        await connection.end();
    } catch (e) {
        console.error(e);
    } finally {
        await mainPool.end();
        process.exit(0);
    }
}
run();
