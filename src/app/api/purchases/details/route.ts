import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

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
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT D.IdDetalleCompra, D.IdProducto, D.Cantidad, D.Costo, D.Status,
                    P.Codigo, P.Producto, PR.Presentacion,
                    (D.Cantidad * D.Costo) as Total
             FROM tblDetalleCompras D
             INNER JOIN tblProductos P ON D.IdProducto = P.IdProducto
             LEFT JOIN tblPresentaciones PR ON P.IdPresentacion = PR.IdPresentacion
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

        // Insert new purchase detail
        const [result] = await connection.query<ResultSetHeader>(
            `INSERT INTO tblDetalleCompras (IdCompra, IdProducto, Cantidad, Costo, Status, FechaAct)
             VALUES (?, ?, ?, ?, 0, NOW())`,
            [purchaseId, productId, quantity, cost]
        );

        return NextResponse.json({
            success: true,
            message: 'Purchase detail added successfully',
            id: result.insertId
        });
    } catch (error) {
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

        // Delete purchase detail
        await connection.query<ResultSetHeader>(
            'DELETE FROM tblDetalleCompras WHERE IdDetalleCompra = ?',
            [detailId]
        );

        return NextResponse.json({
            success: true,
            message: 'Purchase detail deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting purchase detail:', error);
        return NextResponse.json({ success: false, message: 'Error deleting purchase detail' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
