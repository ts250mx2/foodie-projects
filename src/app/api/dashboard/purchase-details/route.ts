import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, FieldPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const monthStr = searchParams.get('month'); // 0-11
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || monthStr === null || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const monthNum = parseInt(monthStr) + 1; // 1-12 for SQL
        const year = parseInt(yearStr);

        connection = await getProjectConnection(projectId);

        // 1. Total Raw Material Purchases
        const [totalPurchaseRows] = (await connection.query(
            `SELECT SUM(Total) as total 
             FROM tblCompras 
             WHERE IdSucursal = ? AND MONTH(FechaCompra) = ? AND YEAR(FechaCompra) = ? AND Status != 2`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];
        const totalPurchases = totalPurchaseRows[0]?.total || 0;

        // 2. Group by Category (Join through Details and Products)
        const [categoryRows] = (await connection.query(
            `SELECT c.Categoria as name, c.ImagenCategoria as emoji, SUM(d.Cantidad * d.Costo) as value, COUNT(DISTINCT co.IdCompra) as count
             FROM tblCompras co
             JOIN tblDetalleCompras d ON co.IdCompra = d.IdCompra
             JOIN tblProductos p ON d.IdProducto = p.IdProducto
             LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
             WHERE co.IdSucursal = ? AND MONTH(co.FechaCompra) = ? AND YEAR(co.FechaCompra) = ? AND co.Status != 2
             GROUP BY c.Categoria, c.ImagenCategoria`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // 3. Group by Provider
        const [providerRows] = (await connection.query(
            `SELECT p.Proveedor as name, SUM(co.Total) as value, COUNT(co.IdCompra) as count
             FROM tblCompras co
             LEFT JOIN tblProveedores p ON co.IdProveedor = p.IdProveedor
             WHERE co.IdSucursal = ? AND MONTH(co.FechaCompra) = ? AND YEAR(co.FechaCompra) = ? AND co.Status != 2
             GROUP BY p.Proveedor`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // 4. Group by Day
        const [dayRows] = (await connection.query(
            `SELECT DAY(FechaCompra) as name, SUM(Total) as value, COUNT(*) as count
             FROM tblCompras
             WHERE IdSucursal = ? AND MONTH(FechaCompra) = ? AND YEAR(FechaCompra) = ? AND Status != 2
             GROUP BY DAY(FechaCompra)
             ORDER BY DAY(FechaCompra) ASC`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // 5. Group by Product
        const [productRows] = (await connection.query(
            `SELECT p.Producto as name, c.ImagenCategoria as emoji, c.Categoria as categoryName, SUM(d.Cantidad * d.Costo) as value, COUNT(DISTINCT co.IdCompra) as count
             FROM tblCompras co
             JOIN tblDetalleCompras d ON co.IdCompra = d.IdCompra
             JOIN tblProductos p ON d.IdProducto = p.IdProducto
             LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
             WHERE co.IdSucursal = ? AND MONTH(co.FechaCompra) = ? AND YEAR(co.FechaCompra) = ? AND co.Status != 2
             GROUP BY p.Producto, c.ImagenCategoria, c.Categoria`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];

        return NextResponse.json({
            success: true,
            data: {
                categories: categoryRows,
                providers: providerRows,
                products: productRows,
                days: dayRows,
                totalPurchases
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard purchase details:', error);
        return NextResponse.json({ success: false, message: 'Error fetching dashboard purchase details' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
