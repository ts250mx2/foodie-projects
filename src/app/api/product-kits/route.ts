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
            return NextResponse.json({ success: false, message: 'Project ID and Product ID are required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const productId = parseInt(productIdStr);
        connection = await getProjectConnection(projectId);

        const [rows] = await connection.query(
            `SELECT 
                pk.IdProductoPadre,
                pk.IdProductoHijo,
                pk.Cantidad,
                p.Producto,
                p.Codigo,
                c.Categoria,
                pr.Presentacion
            FROM tblProductosKits pk
            INNER JOIN tblProductos p ON pk.IdProductoHijo = p.IdProducto
            LEFT JOIN tblCategorias c ON p.IdCategoria = c.IdCategoria
            LEFT JOIN tblPresentaciones pr ON p.IdPresentacion = pr.IdPresentacion
            WHERE pk.IdProductoPadre = ?
            ORDER BY p.Producto ASC`,
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
        const { projectId, idProductoPadre, idProductoHijo, cantidad } = body;

        if (!projectId || !idProductoPadre || !idProductoHijo || cantidad === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Use INSERT ... ON DUPLICATE KEY UPDATE to replace if exists
        // This requires a UNIQUE constraint on (IdProductoPadre, IdProductoHijo)
        const [result] = await connection.query(
            `INSERT INTO tblProductosKits (IdProductoPadre, IdProductoHijo, Cantidad, FechaAct) 
             VALUES (?, ?, ?, Now())
             ON DUPLICATE KEY UPDATE 
             Cantidad = VALUES(Cantidad),
             FechaAct = Now()`,
            [idProductoPadre, idProductoHijo, cantidad]
        );

        return NextResponse.json({
            success: true,
            message: 'Product kit item saved successfully',
            id: result.insertId || result.affectedRows
        });
    } catch (error) {
        console.error('Error saving product kit item:', error);
        return NextResponse.json({ success: false, message: 'Error saving product kit item' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

