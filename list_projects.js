const mysql = require('mysql2/promise');

async function run() {
    const mainPool = mysql.createPool({
        host: 'integramembers.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDFoodieProjects'
    });

    try {
        const [projects] = await mainPool.query('SELECT IdProyecto, Proyecto FROM tblProyectos');
        console.log(JSON.stringify(projects));
    } catch (e) {
        console.error(e);
    } finally {
        await mainPool.end();
        process.exit(0);
    }
}
run();
