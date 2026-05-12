import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        
        connection = await getProjectConnection(projectId);

        let query = `
            SELECT 
                oc.*, 
                p.Proveedor,
                s.Sucursal,
                (SELECT SUM(Total) FROM tblOrdenesCompraDetalle WHERE IdOrdenCompra = oc.IdOrdenCompra) as Total
            FROM tblOrdenesCompra oc
            LEFT JOIN tblProveedores p ON oc.IdProveedor = p.IdProveedor
            LEFT JOIN tblSucursales s ON oc.IdSucursal = s.IdSucursal
            WHERE oc.Status != 2
        `;

        const queryParams: any[] = [];

        if (startDate) {
            query += ' AND oc.FechaOrden >= ?';
            queryParams.push(`${startDate} 00:00:00`);
        }
        if (endDate) {
            query += ' AND oc.FechaOrden <= ?';
            queryParams.push(`${endDate} 23:59:59`);
        }

        query += ' ORDER BY oc.FechaOrden DESC';

        const [rows] = await connection.query(query, queryParams);

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching purchase orders:', error);
        return NextResponse.json({ success: false, message: 'Error fetching purchase orders' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PATCH(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, idOrdenCompra, status } = body;

        if (!projectId || !idOrdenCompra || status === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));
        await connection.query(
            'UPDATE tblOrdenesCompra SET Status = ?, FechaAct = Now() WHERE IdOrdenCompra = ?',
            [status, idOrdenCompra]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating order status:', error);
        return NextResponse.json({ success: false, message: 'Error updating status' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, idProveedor, idSucursal, fechaEntrega, fechaProgramadaEntrega, notas, items, esInterna } = body;

        if (!projectId || (!idProveedor && !esInterna) || !idSucursal || !items || !Array.isArray(items)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        await connection.beginTransaction();

        // Ensure UnidadMedidaPedido column exists
        await connection.query(`
            ALTER TABLE tblOrdenesCompraDetalle 
            ADD COLUMN IF NOT EXISTS UnidadMedidaPedido VARCHAR(30) NULL DEFAULT NULL
        `).catch(() => {});

        let finalIdProveedor = idProveedor;

        if (esInterna) {
            const internalName = body.providerName || "ORDEN DE COMPRA INTERNA";
            const [provRows] = await connection.query('SELECT IdProveedor FROM tblProveedores WHERE Proveedor = ?', [internalName]);
            if ((provRows as any[]).length > 0) {
                finalIdProveedor = (provRows as any[])[0].IdProveedor;
            } else {
                const [newProv] = await connection.query('INSERT INTO tblProveedores (Proveedor, Status, FechaAct) VALUES (?, 0, Now())', [internalName]);
                finalIdProveedor = (newProv as any).insertId;
            }
        }

        // 1. Create Purchase Order (FechaOrden is Now())
        const [result] = await connection.query(
            'INSERT INTO tblOrdenesCompra (IdProveedor, IdSucursal, EsInterna, FechaOrden, FechaEntrega, FechaProgramadaEntrega, Status, Notas, FechaAct) VALUES (?, ?, ?, Now(), ?, ?, 0, ?, Now())',
            [finalIdProveedor, idSucursal, esInterna ? 1 : 0, fechaEntrega || null, fechaProgramadaEntrega || null, notas || null]
        );

        const idOrdenCompra = (result as ResultSetHeader).insertId;

        // 2. Create Details and update Provider-Product relationship
        for (const item of items) {
            await connection.query(
                'INSERT INTO tblOrdenesCompraDetalle (IdOrdenCompra, IdProducto, Cantidad, PrecioUnitario, Total, UnidadMedidaPedido, FechaAct) VALUES (?, ?, ?, ?, ?, ?, Now())',
                [idOrdenCompra, item.idProducto, item.cantidad, item.precioUnitario, item.cantidad * item.precioUnitario, item.unidadMedida || null]
            );

            // Update relationship using the resolved provider ID
            await connection.query(`
                INSERT INTO tblProveedoresProductos (IdProveedor, IdProducto, UltimoPrecio, FechaAct)
                VALUES (?, ?, ?, Now())
                ON DUPLICATE KEY UPDATE UltimoPrecio = ?, FechaAct = Now()
            `, [finalIdProveedor || 0, item.idProducto, item.precioUnitario, item.precioUnitario]);

            // Update tblProductos with new name and cost
            await connection.query(
                'UPDATE tblProductos SET Producto = ?, Precio = ?, FechaAct = Now() WHERE IdProducto = ?',
                [item.producto, item.precioUnitario, item.idProducto]
            );
        }

        await connection.commit();

        return NextResponse.json({ success: true, id: idOrdenCompra });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error creating purchase order:', error);
        return NextResponse.json({ success: false, message: 'Error creating purchase order' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, idOrdenCompra, idProveedor, idSucursal, esInterna, fechaEntrega, fechaProgramadaEntrega, notas, items } = body;

        if (!projectId || !idOrdenCompra || (!idProveedor && !esInterna) || !idSucursal || !items || !Array.isArray(items)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        await connection.beginTransaction();

        let finalIdProveedor = idProveedor;
        if (esInterna) {
            const [provRows] = await connection.query('SELECT IdProveedor FROM tblProveedores WHERE Proveedor = "ORDEN DE COMPRA INTERNA"');
            if ((provRows as any[]).length > 0) {
                finalIdProveedor = (provRows as any[])[0].IdProveedor;
            } else {
                const [newProv] = await connection.query('INSERT INTO tblProveedores (Proveedor, Status, FechaAct) VALUES ("ORDEN DE COMPRA INTERNA", 0, Now())');
                finalIdProveedor = (newProv as any).insertId;
            }
        }

        // Ensure UnidadMedidaPedido column exists
        await connection.query(`
            ALTER TABLE tblOrdenesCompraDetalle 
            ADD COLUMN IF NOT EXISTS UnidadMedidaPedido VARCHAR(30) NULL DEFAULT NULL
        `).catch(() => {});

        // 1. Update Header
        await connection.query(
            'UPDATE tblOrdenesCompra SET IdProveedor = ?, IdSucursal = ?, EsInterna = ?, FechaEntrega = ?, FechaProgramadaEntrega = ?, Notas = ?, FechaAct = Now() WHERE IdOrdenCompra = ?',
            [finalIdProveedor || 0, idSucursal, esInterna ? 1 : 0, fechaEntrega || null, fechaProgramadaEntrega || null, notas || null, idOrdenCompra]
        );

        // 2. Delete existing items
        await connection.query('DELETE FROM tblOrdenesCompraDetalle WHERE IdOrdenCompra = ?', [idOrdenCompra]);

        // 3. Insert new items
        for (const item of items) {
            await connection.query(
                'INSERT INTO tblOrdenesCompraDetalle (IdOrdenCompra, IdProducto, Cantidad, PrecioUnitario, Total, UnidadMedidaPedido, FechaAct) VALUES (?, ?, ?, ?, ?, ?, Now())',
                [idOrdenCompra, item.idProducto, item.cantidad, item.precioUnitario, item.cantidad * item.precioUnitario, item.unidadMedida || null]
            );

            // Update relationship
            await connection.query(`
                INSERT INTO tblProveedoresProductos (IdProveedor, IdProducto, UltimoPrecio, FechaAct)
                VALUES (?, ?, ?, Now())
                ON DUPLICATE KEY UPDATE UltimoPrecio = ?, FechaAct = Now()
            `, [finalIdProveedor || 0, item.idProducto, item.precioUnitario, item.precioUnitario]);

            // Update tblProductos with new name and cost
            await connection.query(
                'UPDATE tblProductos SET Producto = ?, Precio = ?, FechaAct = Now() WHERE IdProducto = ?',
                [item.producto, item.precioUnitario, item.idProducto]
            );
        }

        await connection.commit();
        return NextResponse.json({ success: true, message: 'Purchase order updated successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating purchase order:', error);
        return NextResponse.json({ success: false, message: 'Error updating purchase order' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const idOrdenCompra = searchParams.get('id');

        if (!projectIdStr || !idOrdenCompra) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // Soft delete: Set Status = 2
        await connection.query(
            'UPDATE tblOrdenesCompra SET Status = 2, FechaAct = Now() WHERE IdOrdenCompra = ?',
            [idOrdenCompra]
        );

        return NextResponse.json({ success: true, message: 'Purchase order deleted successfully' });
    } catch (error) {
        console.error('Error deleting purchase order:', error);
        return NextResponse.json({ success: false, message: 'Error deleting purchase order' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
