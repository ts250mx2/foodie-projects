import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { Connection } from 'mysql2/promise';
import { ResultSetHeader } from 'mysql2';
import {
    applyOrderToWarehouse,
    OC_STATUS_APPLIED as STATUS_APPLIED,
    OC_STATUS_PHANTOM as STATUS_PHANTOM,
    OC_STATUS_DISCARDED as STATUS_DISCARDED,
} from '@/lib/warehouse';

/**
 * Estados de tblOrdenesCompra: ver src/lib/warehouse.ts.
 * Una orden "aplicada" (FechaAplicacion != NULL) ya afectó el inventario de almacén
 * y no puede editarse, eliminarse ni volver a aplicarse.
 */
// Aplicable: cualquier orden que aún no afectó el inventario (FechaAplicacion NULL),
// incluidas las "Surtido" legadas (Status 1 previo al módulo de almacén).
const APPLICABLE_STATUSES = [0, STATUS_APPLIED, STATUS_PHANTOM];

/** Busca o crea un proveedor por nombre (para órdenes internas y salidas de almacén). */
async function resolveNamedProvider(connection: Connection, name: string): Promise<number> {
    const [rows] = await connection.query('SELECT IdProveedor FROM tblProveedores WHERE Proveedor = ?', [name]);
    if ((rows as any[]).length > 0) return (rows as any[])[0].IdProveedor;
    const [inserted] = await connection.query(
        'INSERT INTO tblProveedores (Proveedor, Status, FechaAct) VALUES (?, 0, Now())',
        [name]
    );
    return (inserted as ResultSetHeader).insertId;
}


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
        // tipo: 'compras' → solo entradas (órdenes de compra / pedidos internos);
        //       'salidas' → solo salidas internas de almacén; sin tipo → todas.
        const tipo = searchParams.get('tipo');

        connection = await getProjectConnection(projectId);

        let query = `
            SELECT
                oc.*,
                p.Proveedor,
                s.Sucursal,
                (SELECT SUM(Total) FROM tblOrdenesCompraDetalle WHERE IdOrdenCompra = oc.IdOrdenCompra) as Total,
                (SELECT COUNT(*) FROM tblOrdenesCompraDetalle WHERE IdOrdenCompra = oc.IdOrdenCompra) as Renglones
            FROM tblOrdenesCompra oc
            LEFT JOIN tblProveedores p ON oc.IdProveedor = p.IdProveedor
            LEFT JOIN tblSucursales s ON oc.IdSucursal = s.IdSucursal
            WHERE oc.Status != 2
        `;

        if (tipo === 'salidas') {
            query += ' AND oc.EsSalida = 1';
        } else if (tipo === 'compras') {
            query += ' AND (oc.EsSalida IS NULL OR oc.EsSalida = 0)';
        }

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
        const { projectId, idOrdenCompra, status, action } = body;

        if (!projectId || !idOrdenCompra || (status === undefined && !action)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        // Cambio de estado simple (compatibilidad con el flujo anterior).
        if (!action) {
            await connection.query(
                'UPDATE tblOrdenesCompra SET Status = ?, FechaAct = Now() WHERE IdOrdenCompra = ?',
                [status, idOrdenCompra]
            );
            return NextResponse.json({ success: true });
        }

        await connection.beginTransaction();

        const [ordRows] = await connection.query(
            'SELECT * FROM tblOrdenesCompra WHERE IdOrdenCompra = ? FOR UPDATE',
            [idOrdenCompra]
        );
        const order = (ordRows as any[])[0];
        if (!order) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: 'Orden no encontrada' }, { status: 404 });
        }

        if (action === 'apply') {
            if (order.FechaAplicacion) {
                await connection.rollback();
                return NextResponse.json({ success: false, message: 'La orden ya fue aplicada al inventario' }, { status: 409 });
            }
            if (!APPLICABLE_STATUSES.includes(Number(order.Status))) {
                await connection.rollback();
                return NextResponse.json({ success: false, message: 'La orden no está en un estado aplicable' }, { status: 409 });
            }

            const [items] = await connection.query(
                `SELECT ocd.*, p.UnidadMedidaCompra, p.UnidadMedidaInventario
                 FROM tblOrdenesCompraDetalle ocd
                 JOIN tblProductos p ON ocd.IdProducto = p.IdProducto
                 WHERE ocd.IdOrdenCompra = ?`,
                [idOrdenCompra]
            );
            if ((items as any[]).length === 0) {
                await connection.rollback();
                return NextResponse.json({ success: false, message: 'La orden no tiene productos' }, { status: 409 });
            }

            await applyOrderToWarehouse(connection, order, items as any[]);

            await connection.query(
                'UPDATE tblOrdenesCompra SET Status = ?, FechaAplicacion = Now(), FechaAct = Now() WHERE IdOrdenCompra = ?',
                [STATUS_APPLIED, idOrdenCompra]
            );
            await connection.commit();
            return NextResponse.json({ success: true, message: 'Orden aplicada al inventario' });
        }

        if (action === 'discard') {
            if (order.FechaAplicacion) {
                await connection.rollback();
                return NextResponse.json({ success: false, message: 'No se puede descartar una orden ya aplicada' }, { status: 409 });
            }
            if (!APPLICABLE_STATUSES.includes(Number(order.Status))) {
                await connection.rollback();
                return NextResponse.json({ success: false, message: 'La orden no está en un estado descartable' }, { status: 409 });
            }
            await connection.query(
                'UPDATE tblOrdenesCompra SET Status = ?, FechaAct = Now() WHERE IdOrdenCompra = ?',
                [STATUS_DISCARDED, idOrdenCompra]
            );
            await connection.commit();
            return NextResponse.json({ success: true, message: 'Orden descartada' });
        }

        if (action === 'restore') {
            if (Number(order.Status) !== STATUS_DISCARDED) {
                await connection.rollback();
                return NextResponse.json({ success: false, message: 'Solo se pueden restaurar órdenes descartadas' }, { status: 409 });
            }
            await connection.query(
                'UPDATE tblOrdenesCompra SET Status = ?, FechaAct = Now() WHERE IdOrdenCompra = ?',
                [STATUS_PHANTOM, idOrdenCompra]
            );
            await connection.commit();
            return NextResponse.json({ success: true, message: 'Orden restaurada' });
        }

        await connection.rollback();
        return NextResponse.json({ success: false, message: 'Acción no válida' }, { status: 400 });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
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
        const { projectId, idProveedor, idSucursal, fechaEntrega, fechaProgramadaEntrega, notas, items, esInterna, esSalida } = body;

        if (!projectId || (!idProveedor && !esInterna && !esSalida) || !idSucursal || !items || !Array.isArray(items)) {
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

        if (esSalida) {
            finalIdProveedor = await resolveNamedProvider(connection, 'SALIDA INTERNA DE ALMACÉN');
        } else if (esInterna) {
            finalIdProveedor = await resolveNamedProvider(connection, body.providerName || 'ORDEN DE COMPRA INTERNA');
        }

        // 1. Crea la orden como "Fantasma" (Status 4): pendiente de aplicar al
        //    inventario o de descartarse. FechaOrden es Now().
        const [result] = await connection.query(
            'INSERT INTO tblOrdenesCompra (IdProveedor, IdSucursal, EsInterna, EsSalida, FechaOrden, FechaEntrega, FechaProgramadaEntrega, Status, Notas, FechaAct) VALUES (?, ?, ?, ?, Now(), ?, ?, ?, ?, Now())',
            [finalIdProveedor, idSucursal, esInterna ? 1 : 0, esSalida ? 1 : 0, fechaEntrega || null, fechaProgramadaEntrega || null, STATUS_PHANTOM, notas || null]
        );

        const idOrdenCompra = (result as ResultSetHeader).insertId;

        // 2. Create Details and update Provider-Product relationship
        for (const item of items) {
            await connection.query(
                'INSERT INTO tblOrdenesCompraDetalle (IdOrdenCompra, IdProducto, Cantidad, PrecioUnitario, Total, UnidadMedidaPedido, FechaAct) VALUES (?, ?, ?, ?, ?, ?, Now())',
                [idOrdenCompra, item.idProducto, item.cantidad, item.precioUnitario, item.cantidad * item.precioUnitario, item.unidadMedida || null]
            );

            // Las salidas de almacén no actualizan precios ni la relación proveedor-producto.
            if (esSalida) continue;

            // Update relationship using the resolved provider ID
            await connection.query(`
                INSERT INTO tblProveedoresProductos (IdProveedor, IdProducto, UltimoPrecio, FechaAct)
                VALUES (?, ?, ?, Now())
                ON DUPLICATE KEY UPDATE UltimoPrecio = ?, FechaAct = Now()
            `, [finalIdProveedor || 0, item.idProducto, item.precioUnitario, item.precioUnitario]);

            // Update tblProductos — only update name if provided, always update price
            if (item.producto) {
                await connection.query(
                    'UPDATE tblProductos SET Producto = ?, Precio = ?, FechaAct = Now() WHERE IdProducto = ?',
                    [item.producto, item.precioUnitario, item.idProducto]
                );
            } else {
                await connection.query(
                    'UPDATE tblProductos SET Precio = ?, FechaAct = Now() WHERE IdProducto = ?',
                    [item.precioUnitario, item.idProducto]
                );
            }

            // If the product has no UnidadMedidaInventario and we have one, update it
            if (item.unidadMedida) {
                await connection.query(`
                    UPDATE tblProductos
                    SET UnidadMedidaInventario = ?, FechaAct = Now()
                    WHERE IdProducto = ? AND (UnidadMedidaInventario IS NULL OR UnidadMedidaInventario = '')
                `, [item.unidadMedida, item.idProducto]);
            }
        }

        // Las SALIDAS se aplican al almacén automáticamente al crearse:
        // restan existencias al costo promedio vigente y quedan como Aplicadas.
        if (esSalida) {
            const [orderItems] = await connection.query(
                `SELECT ocd.*, p.UnidadMedidaCompra, p.UnidadMedidaInventario
                 FROM tblOrdenesCompraDetalle ocd
                 JOIN tblProductos p ON ocd.IdProducto = p.IdProducto
                 WHERE ocd.IdOrdenCompra = ?`,
                [idOrdenCompra]
            );
            await applyOrderToWarehouse(
                connection,
                { IdOrdenCompra: idOrdenCompra, IdSucursal: idSucursal, EsSalida: 1 },
                orderItems as any[]
            );
            await connection.query(
                'UPDATE tblOrdenesCompra SET Status = ?, FechaAplicacion = Now(), FechaAct = Now() WHERE IdOrdenCompra = ?',
                [STATUS_APPLIED, idOrdenCompra]
            );
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            id: idOrdenCompra,
            applied: Boolean(esSalida),
            message: esSalida ? 'Salida aplicada al almacén' : undefined,
        });
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
        const { projectId, idOrdenCompra, idProveedor, idSucursal, esInterna, esSalida, fechaEntrega, fechaProgramadaEntrega, notas, items } = body;

        if (!projectId || !idOrdenCompra || (!idProveedor && !esInterna && !esSalida) || !idSucursal || !items || !Array.isArray(items)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        await connection.beginTransaction();

        // Una orden aplicada ya afectó el inventario: no se puede editar.
        const [currentRows] = await connection.query(
            'SELECT FechaAplicacion FROM tblOrdenesCompra WHERE IdOrdenCompra = ? FOR UPDATE',
            [idOrdenCompra]
        );
        if ((currentRows as any[])[0]?.FechaAplicacion) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: 'La orden ya fue aplicada al inventario y no puede editarse. Usa un ajuste de almacén para corregir existencias.' }, { status: 409 });
        }

        let finalIdProveedor = idProveedor;
        if (esSalida) {
            finalIdProveedor = await resolveNamedProvider(connection, 'SALIDA INTERNA DE ALMACÉN');
        } else if (esInterna) {
            finalIdProveedor = await resolveNamedProvider(connection, 'ORDEN DE COMPRA INTERNA');
        }

        // Ensure UnidadMedidaPedido column exists
        await connection.query(`
            ALTER TABLE tblOrdenesCompraDetalle
            ADD COLUMN IF NOT EXISTS UnidadMedidaPedido VARCHAR(30) NULL DEFAULT NULL
        `).catch(() => {});

        // 1. Update Header
        await connection.query(
            'UPDATE tblOrdenesCompra SET IdProveedor = ?, IdSucursal = ?, EsInterna = ?, EsSalida = ?, FechaEntrega = ?, FechaProgramadaEntrega = ?, Notas = ?, FechaAct = Now() WHERE IdOrdenCompra = ?',
            [finalIdProveedor || 0, idSucursal, esInterna ? 1 : 0, esSalida ? 1 : 0, fechaEntrega || null, fechaProgramadaEntrega || null, notas || null, idOrdenCompra]
        );

        // 2. Delete existing items
        await connection.query('DELETE FROM tblOrdenesCompraDetalle WHERE IdOrdenCompra = ?', [idOrdenCompra]);

        // 3. Insert new items
        for (const item of items) {
            await connection.query(
                'INSERT INTO tblOrdenesCompraDetalle (IdOrdenCompra, IdProducto, Cantidad, PrecioUnitario, Total, UnidadMedidaPedido, FechaAct) VALUES (?, ?, ?, ?, ?, ?, Now())',
                [idOrdenCompra, item.idProducto, item.cantidad, item.precioUnitario, item.cantidad * item.precioUnitario, item.unidadMedida || null]
            );

            // Las salidas de almacén no actualizan precios ni la relación proveedor-producto.
            if (esSalida) continue;

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

        // Una orden aplicada ya afectó el inventario: no se puede eliminar.
        const [rows] = await connection.query(
            'SELECT FechaAplicacion FROM tblOrdenesCompra WHERE IdOrdenCompra = ?',
            [idOrdenCompra]
        );
        if ((rows as any[])[0]?.FechaAplicacion) {
            return NextResponse.json({ success: false, message: 'La orden ya fue aplicada al inventario y no puede eliminarse. Usa un ajuste de almacén para corregir existencias.' }, { status: 409 });
        }

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
