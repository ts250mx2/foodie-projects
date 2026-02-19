const mysql = require('mysql2/promise');

async function debug() {
    const pool = mysql.createPool({
        host: 'integramembers.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDFoodieProjects',
        port: 3306,
    });

    try {
        console.log(`Checking all projects...`);

        const [projects] = await pool.query('SELECT IdProyecto, Proyecto FROM tblProyectos');
        console.log('Available Projects:', projects);
        if (projects.length === 0) {
            console.log('No projects found');
            return;
        }

        const projectId = projects[0].IdProyecto;
        console.log(`Testing with projectId: ${projectId}`);

        const [projRows] = await pool.query('SELECT * FROM tblProyectos WHERE IdProyecto = ?', [projectId]);
        const project = projRows[0];
        const dbUser = project.UsuarioBD || project.UsarioBD;
        const dbPass = project.PasswordBD || project.PasswdBD;

        const connection = await mysql.createConnection({
            host: project.Servidor,
            user: dbUser,
            password: dbPass,
            database: project.BaseDatos,
        });

        console.log(`Connected to ${project.BaseDatos}`);

        const [cats] = await connection.query('SELECT count(*) as count FROM tblCategorias WHERE Status = 0');
        console.log(`tblCategorias (Status=0): ${cats[0].count}`);

        const [recCats] = await connection.query('SELECT count(*) as count FROM tblCategoriasRecetario WHERE Status = 0');
        console.log(`tblCategoriasRecetario (Status=0): ${recCats[0].count}`);

        if (cats[0].count > 0) {
            const [cdata] = await connection.query('SELECT Categoria FROM tblCategorias WHERE Status = 0 LIMIT 5');
            console.log('Sample Cats:', cdata.map(c => c.Categoria));
        }

        if (recCats[0].count > 0) {
            const [rdata] = await connection.query('SELECT CategoriaRecetario FROM tblCategoriasRecetario WHERE Status = 0 LIMIT 5');
            console.log('Sample Recetario:', rdata.map(c => c.CategoriaRecetario));
        }

        await connection.end();
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

debug();
