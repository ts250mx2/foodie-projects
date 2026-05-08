import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, products } = body;

        if (!projectId || !products || !Array.isArray(products)) {
            return NextResponse.json({ success: false, message: 'Invalid data' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS tblBufferProductos (
                IdBuffer INT AUTO_INCREMENT PRIMARY KEY,
                ProductoDocumento VARCHAR(255),
                Producto VARCHAR(255),
                Precio DECIMAL(10,2),
                Codigo VARCHAR(50),
                IdCategoria INT DEFAULT 0,
                Status INT DEFAULT 0,
                FechaAct DATETIME
            )
        `);

        // Force Auto Increment and Primary Key if not set correctly
        try {
            await connection.query('ALTER TABLE tblBufferProductos MODIFY COLUMN IdBuffer INT AUTO_INCREMENT PRIMARY KEY');
        } catch (e) {
            // Might fail if already a primary key, try just modifying to auto_increment
            try {
                await connection.query('ALTER TABLE tblBufferProductos MODIFY COLUMN IdBuffer INT AUTO_INCREMENT');
            } catch (e2) {}
        }

        // Start transaction
        await connection.beginTransaction();

        let insertedCount = 0;
        for (const product of products) {
            const rawName = product.ProductoDocumento || product.Descripción || product.Producto || '';
            const cleanName = product.Producto || product.Descripción || '';
            const codigo = product.Codigo?.toString() || '';
            const precio = parseFloat(product.Precio) || 0;

            await connection.query(
                `INSERT INTO tblBufferProductos (ProductoDocumento, Producto, Precio, Codigo, Status, FechaAct) 
                 VALUES (?, ?, ?, ?, 0, NOW())`,
                [rawName.toUpperCase(), cleanName.toUpperCase(), precio, codigo.toUpperCase()]
            );
            insertedCount++;
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: `Se han insertado ${insertedCount} productos al buffer correctamente.`,
            count: insertedCount
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error processing buffer product upload:', error);
        return NextResponse.json({ success: false, message: 'Error procesando la carga al buffer' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
