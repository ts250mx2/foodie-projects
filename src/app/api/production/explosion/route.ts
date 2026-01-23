import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const dateStr = searchParams.get('date');

        if (!projectIdStr || !branchIdStr || !dateStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const date = new Date(dateStr);

        // Extract day, month, year for the query
        // Note: JS months are 0-indexed, MySQL MONTH() is 1-indexed
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        connection = await getProjectConnection(projectId);

        const query = `
            SELECT 
                B.Codigo, 
                B.Producto, 
                C.Categoria, 
                SUM(E.Cantidad * A.Cantidad) AS Cantidad, 
                D.Presentacion, 
                B.Precio, 
                SUM(E.Cantidad * A.Cantidad * B.Precio) As Total 
            FROM tblProductosKits A 
            INNER JOIN tblProductos B ON A.IdProductoHijo = B.IdProducto 
            INNER JOIN tblCategorias C ON B.IdCategoria = C.IdCategoria 
            INNER JOIN tblPresentaciones D ON B.IdPresentacion = D.IdPresentacion 
            INNER JOIN tblProduccion E ON A.IdProductoPadre = E.IdProducto 
            WHERE 
                DAY(E.FechaProduccion) = ? AND 
                MONTH(E.FechaProduccion) = ? AND 
                YEAR(E.FechaProduccion) = ? AND 
                E.idSucursal = ? 
            GROUP BY 
                B.Codigo, 
                B.Producto, 
                C.Categoria, 
                D.Presentacion, 
                B.Precio
            ORDER BY
                C.Categoria,
                B.Producto
        `;

        const [rows] = await connection.query(query, [day, month, year, branchId]);

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error calculating total explosion:', error);
        return NextResponse.json({ success: false, message: 'Error calculating total explosion' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

