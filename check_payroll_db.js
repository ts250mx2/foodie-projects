const { getProjectConnection } = require('./src/lib/dynamic-db');
const projectId = 1;

async function check() {
    try {
        const connection = await getProjectConnection(projectId);
        
        const [payrollCols] = await connection.query('SHOW COLUMNS FROM tblNomina');
        console.log('Columns for tblNomina:');
        console.table(payrollCols);
        
        const [employeeCols] = await connection.query('SHOW COLUMNS FROM tblEmpleados');
        console.log('Columns for tblEmpleados:');
        console.table(employeeCols);

        const [tables] = await connection.query('SHOW TABLES');
        const tableList = tables.map(t => Object.values(t)[0]);
        console.log('Tables in DB:', tableList.filter(t => t.toLowerCase().includes('puesto')));
        
        if (tableList.some(t => t === 'tblPuestos')) {
            const [puestoCols] = await connection.query('SHOW COLUMNS FROM tblPuestos');
            console.log('Columns for tblPuestos:');
            console.table(puestoCols);
        }
        
        await connection.end();
    } catch (e) {
        console.error(e);
    }
}
check();
