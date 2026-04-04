const { getProjectConnection } = require('./src/lib/dynamic-db');
const projectId = 1;

async function check() {
    try {
        const connection = await getProjectConnection(projectId);
        
        const [purchaseCols] = await connection.query('SHOW COLUMNS FROM tblCompras');
        console.log('Columns for tblCompras:');
        console.table(purchaseCols);
        
        const [categoryCols] = await connection.query('SHOW COLUMNS FROM tblCategorias');
        console.log('Columns for tblCategorias:');
        console.table(categoryCols);
        
        await connection.end();
    } catch (e) {
        console.error(e);
    }
}
check();
