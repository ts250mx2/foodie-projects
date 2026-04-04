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

        // 1. Total Waste
        const [totalWasteRows] = (await connection.query(
            `SELECT SUM(Cantidad * Precio) as total 
             FROM tblMermas 
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];
        const totalWaste = totalWasteRows[0]?.total || 0;

        // 2. Group by Category (Join through Products)
        const [categoryRows] = (await connection.query(
            `SELECT c.Categoria as name, c.ImagenCategoria as emoji, SUM(m.Cantidad * m.Precio) as value, COUNT(m.IdProducto) as count
             FROM tblMermas m
             JOIN tblProductos p ON m.IdProducto = p.IdProducto
             LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
             WHERE m.IdSucursal = ? AND m.Mes = ? AND m.Anio = ?
             GROUP BY c.Categoria, c.ImagenCategoria`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // 3. Group by Day
        const [dayRows] = (await connection.query(
            `SELECT Dia as name, SUM(Cantidad * Precio) as value, COUNT(*) as count
             FROM tblMermas
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?
             GROUP BY Dia
             ORDER BY Dia ASC`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];

        return NextResponse.json({
            success: true,
            data: {
                categories: categoryRows,
                days: dayRows,
                totalWaste
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard waste details:', error);
        return NextResponse.json({ success: false, message: 'Error fetching dashboard waste details' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
