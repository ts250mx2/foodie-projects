const mysql = require('mysql2/promise');

async function testUpdate() {
    const mainConnection = await mysql.createConnection({
        host: 'IntegraMembers.com',
        user: 'kyk',
        password: 'merkurio',
        database: 'BDFoodieProjects'
    });

    try {
        const [projects] = await mainConnection.query('SELECT IdProyecto, BaseDatos, Servidor, UsarioBD, PasswdBD FROM tblProyectos WHERE IdProyecto = 7');
        const project = projects[0];

        const projectConn = await mysql.createConnection({
            host: project.Servidor,
            user: project.UsarioBD,
            password: project.PasswdBD,
            database: project.BaseDatos
        });

        // Test with Product ID 716 (just an example, need to find one)
        const [products] = await projectConn.query('SELECT IdProducto, Producto, CantidadCompra FROM tblProductos WHERE Status = 0 LIMIT 1');
        if (products.length === 0) {
            console.log('No products found');
            return;
        }

        const product = products[0];
        console.log('Original Product:', product);

        const newQty = (product.CantidadCompra || 0) + 1.5;
        console.log(`Attempting to set CantidadCompra to: ${newQty}`);

        await projectConn.query(
            'UPDATE tblProductos SET CantidadCompra = ?, FechaAct = Now() WHERE IdProducto = ?',
            [newQty, product.IdProducto]
        );

        const [results] = await projectConn.query('SELECT IdProducto, Producto, CantidadCompra FROM tblProductos WHERE IdProducto = ?', [product.IdProducto]);
        console.log('Updated Product:', results[0]);

        if (results[0].CantidadCompra == newQty) {
            console.log('✅ Update SUCCESSFUL in DB');
        } else {
            console.log('❌ Update FAILED in DB');
        }

        await projectConn.end();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mainConnection.end();
    }
}

testUpdate();
