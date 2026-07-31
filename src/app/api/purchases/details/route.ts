import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
    ensureAppliedOrderForCompra,
    findOrderForCompra,
    registerWarehouseMovement,
    syncOrderDetailsFromCompra,
} from '@/lib/warehouse';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const purchaseIdStr = searchParams.get('purchaseId');

        if (!projectIdStr || !purchaseIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const purchaseId = parseInt(purchaseIdStr);

        connection = await getProjectConnection(projectId);

        // Get purchase details with product information
        const [rows] = await connection.query(
            `SELECT D.IdDetalleCompra, D.IdProducto, D.Cantidad, D.Costo, D.Status,
                    P.Codigo, P.Producto, P.UnidadMedidaCompra AS UnidadMedidaCompra,
                    (D.Cantidad * D.Costo) as Total
             FROM tblDetalleCompras D
             INNER JOIN tblProductos P ON D.IdProducto = P.IdProducto
             WHERE D.IdCompra = ?
             ORDER BY D.IdDetalleCompra`,
            [purchaseId]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching purchase details:', error);
        return NextResponse.json({ success: false, message: 'Error fetching purchase details' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, purchaseId, productId, quantity, cost } = body;

        if (!projectId || !purchaseId || !productId || quantity === undefined || cost === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        await connection.beginTransaction();

        // Insert new purchase detail
        const [result] = await connection.query(
            `INSERT INTO tblDetalleCompras (IdCompra, IdProducto, Cantidad, Costo, Status, FechaAct)
             VALUES (?, ?, ?, ?, 0, NOW())`,
            [purchaseId, productId, quantity, cost]
        );

        // Update product price in catalog to reflect most recent purchase cost
        await connection.query(
            `UPDATE tblProductos SET Precio = ?, FechaAct = NOW() WHERE IdProducto = ?`,
            [cost, productId]
        );

        // Toda captura de compra genera (o actualiza) su orden de compra y se
        // aplica al almacén: la entrada del renglón suma existencias de inmediato.
        const orderRef = await ensureAppliedOrderForCompra(connection, purchaseId);
        if (orderRef) {
            if (orderRef.aplicada && Number(quantity) > 0) {
                await registerWarehouseMovement(connection, {
                    idSucursal: orderRef.idSucursal,
                    idProducto: productId,
                    tipo: 'ENTRADA',
                    origen: 'ORDEN_COMPRA',
                    idOrdenCompra: orderRef.idOrden,
                    cantidad: Number(quantity),
                    costoUnitario: Number(cost) || 0,
                    notas: `Captura de compra #${purchaseId}`,
                });
            }
            await syncOrderDetailsFromCompra(connection, orderRef.idOrden, purchaseId);
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: 'Purchase detail added successfully',
            id: result.insertId
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error('Error adding purchase detail:', error);
        return NextResponse.json({ success: false, message: 'Error adding purchase detail' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const detailIdStr = searchParams.get('detailId');

        if (!projectIdStr || !detailIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const detailId = parseInt(detailIdStr);

        connection = await getProjectConnection(projectId);
        await connection.beginTransaction();

        // Lee el renglón antes de borrarlo para poder revertir el almacén.
        const [oldRows]: [RowDataPacket[], any] = await connection.query(
            'SELECT IdCompra, IdProducto, Cantidad FROM tblDetalleCompras WHERE IdDetalleCompra = ? FOR UPDATE',
            [detailId]
        );
        const oldRow = oldRows[0];

        // Delete purchase detail
        await connection.query(
            'DELETE FROM tblDetalleCompras WHERE IdDetalleCompra = ?',
            [detailId]
        );

        // Si la compra tiene orden aplicada, revierte la entrada del renglón.
        if (oldRow) {
            const order = await findOrderForCompra(connection, oldRow.IdCompra);
            if (order) {
                if (order.FechaAplicacion && oldRow.IdProducto && Number(oldRow.Cantidad) > 0) {
                    await registerWarehouseMovement(connection, {
                        idSucursal: order.IdSucursal,
                        idProducto: oldRow.IdProducto,
                        tipo: 'SALIDA',
                        origen: 'ORDEN_COMPRA',
                        idOrdenCompra: order.IdOrdenCompra,
                        cantidad: Number(oldRow.Cantidad),
                        notas: `Renglón eliminado de compra #${oldRow.IdCompra}`,
                    });
                }
                await syncOrderDetailsFromCompra(connection, order.IdOrdenCompra, oldRow.IdCompra);
            }
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: 'Purchase detail deleted successfully'
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error('Error deleting purchase detail:', error);
        return NextResponse.json({ success: false, message: 'Error deleting purchase detail' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, detailId, quantity, cost } = body;

        if (!projectId || !detailId || quantity === undefined || cost === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        await connection.beginTransaction();

        // Lee el renglón actual (producto y cantidad anterior) para el delta de almacén.
        const [rows]: [RowDataPacket[], any] = await connection.query(
            'SELECT IdCompra, IdProducto, Cantidad, Costo FROM tblDetalleCompras WHERE IdDetalleCompra = ? FOR UPDATE',
            [detailId]
        );

        if (rows.length === 0) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: 'Detail not found' }, { status: 404 });
        }

        const productId = rows[0].IdProducto;
        const purchaseId = rows[0].IdCompra;
        const oldQuantity = Number(rows[0].Cantidad) || 0;

        // Update purchase detail
        await connection.query(
            'UPDATE tblDetalleCompras SET Cantidad = ?, Costo = ?, FechaAct = NOW() WHERE IdDetalleCompra = ?',
            [quantity, cost, detailId]
        );

        // Update product price in catalog
        await connection.query(
            'UPDATE tblProductos SET Precio = ?, FechaAct = NOW() WHERE IdProducto = ?',
            [cost, productId]
        );

        // Si la compra tiene orden aplicada, registra el DELTA de cantidad en el
        // kardex (aumento → entrada; disminución → salida al costo promedio).
        const order = await findOrderForCompra(connection, purchaseId);
        if (order) {
            if (order.FechaAplicacion && productId) {
                const deltaQty = (Number(quantity) || 0) - oldQuantity;
                if (deltaQty > 0) {
                    await registerWarehouseMovement(connection, {
                        idSucursal: order.IdSucursal,
                        idProducto: productId,
                        tipo: 'ENTRADA',
                        origen: 'ORDEN_COMPRA',
                        idOrdenCompra: order.IdOrdenCompra,
                        cantidad: deltaQty,
                        costoUnitario: Number(cost) || 0,
                        notas: `Ajuste de renglón en compra #${purchaseId}`,
                    });
                } else if (deltaQty < 0) {
                    await registerWarehouseMovement(connection, {
                        idSucursal: order.IdSucursal,
                        idProducto: productId,
                        tipo: 'SALIDA',
                        origen: 'ORDEN_COMPRA',
                        idOrdenCompra: order.IdOrdenCompra,
                        cantidad: Math.abs(deltaQty),
                        notas: `Ajuste de renglón en compra #${purchaseId}`,
                    });
                }
            }
            await syncOrderDetailsFromCompra(connection, order.IdOrdenCompra, purchaseId);
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: 'Purchase detail updated successfully'
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error('Error updating purchase detail:', error);
        return NextResponse.json({ success: false, message: 'Error updating purchase detail' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

