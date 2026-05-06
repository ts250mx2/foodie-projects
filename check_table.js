const { getProjectConnection } = require('./src/lib/dynamic-db');
async function check() {
    const conn = await getProjectConnection(1);
    try {
        await conn.query('SELECT 1 FROM tblVentasPOS LIMIT 1');
        console.log('EXISTS');
    } catch (e) {
        console.log('NOT_EXISTS');
    } finally {
        await conn.end();
        process.exit(0);
    }
}
check();
