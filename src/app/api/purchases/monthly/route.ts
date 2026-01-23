import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const monthStr = searchParams.get('month'); // 0-11
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || monthStr === null || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const month = parseInt(monthStr) + 1; // Convert to 1-12 for SQL
        const year = parseInt(yearStr);

        connection = await getProjectConnection(projectId);

        // Get monthly purchases grouped by day with provider and item count
        const [rows] = await connection.query(
            `SELECT 
                DAY(C.FechaCompra) as day, 
                P.Proveedor,
                SUM(C.Total) as total,
                COUNT(DISTINCT D.IdDetalleCompra) as itemCount
             FROM tblCompras C
             INNER JOIN tblProveedores P ON C.IdProveedor = P.IdProveedor
             LEFT JOIN tblDetalleCompras D ON C.IdCompra = D.IdCompra
             WHERE C.IdSucursal = ? AND MONTH(C.FechaCompra) = ? AND YEAR(C.FechaCompra) = ? AND C.Status != 2
             GROUP BY DAY(C.FechaCompra), P.Proveedor
             ORDER BY day, P.Proveedor`,
            [branchId, month, year]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching monthly purchases:', error);
        return NextResponse.json({ success: false, message: 'Error fetching monthly purchases' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

