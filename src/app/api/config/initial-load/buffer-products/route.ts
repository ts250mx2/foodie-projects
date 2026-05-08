import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        const idCategoria = searchParams.get('idCategoria');
        const unassignedOnly = searchParams.get('unassignedOnly') === 'true';

        let query = 'SELECT * FROM tblBufferProductos WHERE Status = 0';
        const queryParams: any[] = [];

        if (unassignedOnly) {
            query += ' AND IdCategoria = 0';
        } else if (idCategoria !== null) {
            query += ' AND IdCategoria = ?';
            queryParams.push(idCategoria);
        }

        query += ' ORDER BY FechaAct DESC';

        const [rows] = await connection.query(query, queryParams) as [RowDataPacket[], any];

        return NextResponse.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching buffer products:', error);
        return NextResponse.json({ success: false, message: 'Error al obtener productos en espera' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, producto, precio, codigo } = body;

        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        // Ensure table exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tblBufferProductos (
                IdBuffer INT AUTO_INCREMENT PRIMARY KEY,
                ProductoDocumento VARCHAR(255),
                Producto VARCHAR(255),
                Precio DECIMAL(10,2),
                Codigo VARCHAR(50),
                IdCategoria INT DEFAULT 0,
                UnidadMedidaCompra VARCHAR(50),
                CantidadCompra DECIMAL(10,4) DEFAULT 1,
                UnidadMedidaInventario VARCHAR(50),
                UnidadMedidaRecetario VARCHAR(50),
                ConversionSimple DECIMAL(10,4) DEFAULT 1,
                ArchivoImagen LONGTEXT,
                Status INT DEFAULT 0,
                FechaAct DATETIME
            )
        `);

        const [result] = await connection.query(
            `INSERT INTO tblBufferProductos (ProductoDocumento, Producto, Precio, Codigo, Status, FechaAct) 
             VALUES (?, ?, ?, ?, 0, NOW())`,
            [(producto || 'MANUAL').toUpperCase(), (producto || 'NUEVO PRODUCTO').toUpperCase(), precio || 0, (codigo || '').toUpperCase()]
        ) as [ResultSetHeader, any];

        return NextResponse.json({
            success: true,
            message: 'Producto agregado manualmente',
            idBuffer: result.insertId
        });
    } catch (error) {
        console.error('Error adding manual product:', error);
        return NextResponse.json({ success: false, message: 'Error al agregar producto' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, idBuffer, ids } = body;

        if (!projectId || (!idBuffer && !ids)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        if (ids && Array.isArray(ids)) {
            // Bulk categorization
            const { idCategoria: newIdCat } = body;
            const numericIds = ids.map(id => Number(id)).filter(id => !isNaN(id));
            if (numericIds.length > 0) {
                await connection.query(
                    'UPDATE tblBufferProductos SET IdCategoria = ?, FechaAct = NOW() WHERE IdBuffer IN (?)',
                    [newIdCat, numericIds]
                );
            }
        } else {
            // Single dynamic update
            const fieldsToUpdate: string[] = [];
            const values: any[] = [];
            
            // Map body fields to database columns
            const fieldMap: Record<string, string> = {
                producto: 'Producto',
                precio: 'Precio',
                codigo: 'Codigo',
                idCategoria: 'IdCategoria',
                UnidadMedidaCompra: 'UnidadMedidaCompra',
                CantidadCompra: 'CantidadCompra',
                UnidadMedidaInventario: 'UnidadMedidaInventario',
                UnidadMedidaRecetario: 'UnidadMedidaRecetario',
                ConversionSimple: 'ConversionSimple',
                ArchivoImagen: 'ArchivoImagen'
            };

            Object.entries(fieldMap).forEach(([bodyKey, dbColumn]) => {
                if (body.hasOwnProperty(bodyKey)) {
                    fieldsToUpdate.push(`${dbColumn} = ?`);
                    values.push(body[bodyKey]);
                }
            });

            if (fieldsToUpdate.length > 0) {
                fieldsToUpdate.push('FechaAct = NOW()');
                const query = `UPDATE tblBufferProductos SET ${fieldsToUpdate.join(', ')} WHERE IdBuffer = ?`;
                values.push(idBuffer);
                await connection.query(query, values);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Buffer actualizado correctamente'
        });
    } catch (error: any) {
        console.error('Error updating buffer product:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const idBuffer = searchParams.get('idBuffer');

        if (!projectId || !idBuffer) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        // We could also set Status = 1 if we want soft delete, 
        // but user usually wants to clear the buffer.
        await connection.query(
            'DELETE FROM tblBufferProductos WHERE IdBuffer = ?',
            [idBuffer]
        );

        return NextResponse.json({
            success: true,
            message: 'Producto eliminado del buffer'
        });
    } catch (error) {
        console.error('Error deleting buffer product:', error);
        return NextResponse.json({ success: false, message: 'Error al eliminar el producto' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
