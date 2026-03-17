
const { getProjectConnection } = require('./src/lib/dynamic-db');

async function diagnostic() {
    let connection;
    try {
        connection = await getProjectConnection(9); // Project ID from previous logs
        
        console.log('--- Checking vlProductos view definition ---');
        const [viewRes] = await connection.query('SHOW CREATE VIEW vlProductos');
        if (viewRes.length > 0) {
            console.log('View Definition:', viewRes[0]['Create View']);
        }

        console.log('\n--- Checking triggers on tblInventarios ---');
        const [triggerRes] = await connection.query("SHOW TRIGGERS LIKE 'tblInventarios'");
        console.log('Triggers:', JSON.stringify(triggerRes, null, 2));

        console.log('\n--- Checking data for Product 35 in vlProductos ---');
        try {
            const [prodRes] = await connection.query('SELECT * FROM vlProductos WHERE IdProducto = 35');
            console.log('Product 35 data from view:', JSON.stringify(prodRes, null, 2));
        } catch (e) {
            console.error('Error querying vlProductos for ID 35:', e.message);
        }

        console.log('\n--- Checking product 35 raw data ---');
        const [rawProd] = await connection.query('SELECT * FROM tblProductos WHERE IdProducto = 35');
        console.log('Product 35 raw data:', JSON.stringify(rawProd, null, 2));

    } catch (error) {
        console.error('Diagnostic error:', error);
    } finally {
        if (connection) await connection.end();
    }
}

diagnostic();
