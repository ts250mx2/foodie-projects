import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const productIdStr = searchParams.get('productId');

        if (!projectIdStr || !productIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const productId = parseInt(productIdStr);
        connection = await getProjectConnection(projectId);

        const [rows] = await connection.query(
            `SELECT 
                B.IdProductoPadre,
                A.IdProducto AS IdProductoHijo, 
                A.Producto, 
                A.Codigo,
                B.Cantidad, 
                A.PresentacionConversion AS PresentacionInventario, 
                A.Costo, 
                (B.Cantidad * A.Costo) AS Total,
                A.CategoriaRecetario,
                A.IdCategoriaRecetario
            FROM vlProductos A 
            INNER JOIN tblProductosKits B ON A.IdProducto = B.IdProductoHijo 
            WHERE B.IdProductoPadre = ? 
            ORDER BY A.IdCategoriaRecetario, A.Producto`,
            [productId]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching product kits:', error);
        return NextResponse.json({ success: false, message: 'Error fetching product kits' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, productId, kits } = body;

        if (!projectId || !productId || !Array.isArray(kits)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Start transaction
        await connection.beginTransaction();

        try {
            // Use REPLACE INTO for upsert logic
            for (const kit of kits) {
                await connection.query(
                    `REPLACE INTO tblProductosKits (IdProductoPadre, IdProductoHijo, Cantidad, FechaAct)
                     VALUES (?, ?, ?, NOW())`,
                    [productId, kit.idProductoHijo, kit.cantidad]
                );
            }

            // Commit transaction
            await connection.commit();

            return NextResponse.json({
                success: true,
                message: 'Product kits updated successfully'
            });
        } catch (error) {
            // Rollback on error
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error updating product kits:', error);
        return NextResponse.json({ success: false, message: 'Error updating product kits' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const productIdStr = searchParams.get('productId');
        const childIdStr = searchParams.get('childId');

        if (!projectIdStr || !productIdStr || !childIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const productId = parseInt(productIdStr);
        const childId = parseInt(childIdStr);

        connection = await getProjectConnection(projectId);

        await connection.query(
            'DELETE FROM tblProductosKits WHERE IdProductoPadre = ? AND IdProductoHijo = ?',
            [productId, childId]
        );

        return NextResponse.json({ success: true, message: 'Kit item deleted successfully' });
    } catch (error) {
        console.error('Error deleting kit item:', error);
        return NextResponse.json({ success: false, message: 'Error deleting kit item' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

