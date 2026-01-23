import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const searchParams = request.nextUrl.searchParams;
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const monthStr = searchParams.get('month');
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || !monthStr || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const month = parseInt(monthStr) + 1; // JS 0-11 to SQL 1-12
        const year = parseInt(yearStr);

        connection = await getProjectConnection(projectId);

        const query = `
            SELECT 
                DAY(A.FechaProduccion) as day,
                B.Producto,
                A.Cantidad,
                A.Precio,
                (A.Cantidad * A.Precio) as TotalCost
            FROM tblProduccion A
            INNER JOIN tblProductos B ON A.IdProducto = B.IdProducto
            WHERE 
                A.IdSucursal = ? AND 
                MONTH(A.FechaProduccion) = ? AND 
                YEAR(A.FechaProduccion) = ?
            ORDER BY day, B.Producto
        `;

        const [rows] = await connection.query(query, [branchId, month, year]);

        // Group by day
        const groupedData: Record<number, { day: number, totalCost: number, itemCount: number, items: any[] }> = {};

        rows.forEach((row: any) => {
            const day = row.day;
            if (!groupedData[day]) {
                groupedData[day] = {
                    day,
                    totalCost: 0,
                    itemCount: 0,
                    items: []
                };
            }

            groupedData[day].items.push({
                product: row.Producto,
                quantity: row.Cantidad,
                total: row.TotalCost
            });
            groupedData[day].totalCost += row.TotalCost;
            groupedData[day].itemCount += 1;
        });

        return NextResponse.json({
            success: true,
            data: Object.values(groupedData)
        });

    } catch (error) {
        console.error('Error fetching monthly production:', error);
        return NextResponse.json({ success: false, message: 'Error fetching production data' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

