const { getProjectConnection } = require('./src/lib/dynamic-db');

async function check() {
    let connection;
    try {
        // Assuming projectId 1 for check, or we can try to find an existing one
        const projectId = 1;
        console.log(`Checking DB for project ${projectId}...`);
        connection = await getProjectConnection(projectId);

        const [cats0] = await connection.query('SELECT COUNT(*) as count FROM tblCategorias WHERE Status = 0');
        const [cats1] = await connection.query('SELECT COUNT(*) as count FROM tblCategorias WHERE Status = 1');

        const [recCats0] = await connection.query('SELECT COUNT(*) as count FROM tblCategoriasRecetario WHERE Status = 0');
        const [recCats1] = await connection.query('SELECT COUNT(*) as count FROM tblCategoriasRecetario WHERE Status = 1');

        console.log(`tblCategorias (Status=0): ${cats0[0].count}`);
        console.log(`tblCategorias (Status=1): ${cats1[0].count}`);
        console.log(`tblCategoriasRecetario (Status=0): ${recCats0[0].count}`);
        console.log(`tblCategoriasRecetario (Status=1): ${recCats1[0].count}`);

    } catch (e) {
        console.error(e);
    } finally {
        if (connection) await connection.end();
        process.exit();
    }
}

check();
