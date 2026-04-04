const { getProjectConnection } = require('./src/lib/dynamic-db');
const projectId = 1;

async function check() {
    try {
        const connection = await getProjectConnection(projectId);
        
        const [expenseCols] = await connection.query('SHOW COLUMNS FROM tblGastos');
        console.log('Columns for tblGastos:');
        console.table(expenseCols);
        
        const [conceptCols] = await connection.query('SHOW COLUMNS FROM tblConceptosGastos');
        console.log('Columns for tblConceptosGastos:');
        console.table(conceptCols);

        const [providerCols] = await connection.query('SHOW COLUMNS FROM tblProveedores');
        console.log('Columns for tblProveedores:');
        console.table(providerCols);
        
        await connection.end();
    } catch (e) {
        console.error(e);
    }
}
check();
