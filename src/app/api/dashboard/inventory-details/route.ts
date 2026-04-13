import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, FieldPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const dayStr = searchParams.get('day');
        const monthStr = searchParams.get('month'); // 0-11
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || !dayStr || monthStr === null || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const day = parseInt(dayStr);
        const month = parseInt(monthStr) + 1; // Convert to 1-12 for SQL
        const year = parseInt(yearStr);

        connection = await getProjectConnection(projectId);

        // 1. Group by Category
        const [categoryRows] = (await connection.query(
            `SELECT v.Categoria as name, SUM(I.Cantidad * COALESCE(v.CostoInventario, I.Precio)) as value
             FROM tblInventarios I
             LEFT JOIN vlProductos v ON I.IdProducto = v.IdProducto
             WHERE I.IdSucursal = ? AND I.Dia = ? AND I.Mes = ? AND I.Anio = ?
             GROUP BY v.Categoria
             HAVING value > 0
             ORDER BY value DESC`,
            [branchId, day, month, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // 2. Group by Product
        const [productRows] = (await connection.query(
            `SELECT v.Producto as name, SUM(I.Cantidad * COALESCE(v.CostoInventario, I.Precio)) as value, v.Categoria as category
             FROM tblInventarios I
             LEFT JOIN vlProductos v ON I.IdProducto = v.IdProducto
             WHERE I.IdSucursal = ? AND I.Dia = ? AND I.Mes = ? AND I.Anio = ?
             GROUP BY v.Producto, v.Categoria
             HAVING value > 0
             ORDER BY value DESC`,
            [branchId, day, month, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // 3. Detailed List for the table
        const [detailRows] = (await connection.query(
            `SELECT v.Codigo, v.Producto, v.Categoria, I.Cantidad, COALESCE(v.CostoInventario, I.Precio) as Precio, (I.Cantidad * COALESCE(v.CostoInventario, I.Precio)) as Total
             FROM tblInventarios I
             LEFT JOIN vlProductos v ON I.IdProducto = v.IdProducto
             WHERE I.IdSucursal = ? AND I.Dia = ? AND I.Mes = ? AND I.Anio = ?
             AND (I.Cantidad > 0 OR I.Precio > 0)
             ORDER BY v.Categoria, v.Producto`,
            [branchId, day, month, year]
        )) as [RowDataPacket[], FieldPacket[]];

        const totalCost = detailRows.reduce((acc, row) => acc + (row.Total || 0), 0);

        return NextResponse.json({
            success: true,
            data: {
                categories: categoryRows,
                products: productRows,
                details: detailRows,
                totalCost
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard inventory details:', error);
        return NextResponse.json({ success: false, message: 'Error fetching dashboard inventory details' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
