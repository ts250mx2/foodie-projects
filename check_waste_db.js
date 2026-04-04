const { getProjectConnection } = require('./src/lib/dynamic-db');
const projectId = 1;

async function check() {
    try {
        // Next.js config uses ES modules or something? Usually they use ts-node or run via node if commonjs. 
        // This file was able to run earlier so requiring getProjectConnection works.
        const connection = await getProjectConnection(projectId);
        
        const [wasteCols] = await connection.query('SHOW COLUMNS FROM tblMermas');
        console.log('Columns for tblMermas:');
        console.table(wasteCols);
        
        // Also check tblProductos or tblInsumos to see if Mermas links to it
        // and how it connects to tblCategorias
        
        await connection.end();
    } catch (e) {
        console.error(e);
    }
}
check();
