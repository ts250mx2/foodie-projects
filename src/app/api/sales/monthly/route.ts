import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const monthStr = searchParams.get('month'); // 0-11
        const yearStr = searchParams.get('year');
        const branchIdStr = searchParams.get('branchId');

        if (!projectIdStr || !monthStr || !yearStr || !branchIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const month = parseInt(monthStr);
        const year = parseInt(yearStr);
        const branchId = parseInt(branchIdStr);

        connection = await getProjectConnection(projectId);

        // Get detailed sales per day grouped by shift
        const query = `
            SELECT 
                A.Dia as day,
                A.IdTurno,
                B.Turno as shiftName,
                SUM(A.Venta) as total
            FROM tblVentas A
            INNER JOIN tblTurnos B ON A.IdTurno = B.IdTurno
            WHERE A.Mes = ? AND A.Anio = ? AND A.IdSucursal = ?
            GROUP BY A.Dia, A.IdTurno, B.Turno
            ORDER BY A.Dia, A.IdTurno
        `;

        const [rows] = (await connection.query(query, [month, year, branchId]);

        return NextResponse.json({ success: true, data: rows });

    } catch (error) {
        console.error('Error fetching monthly sales:', error);
        return NextResponse.json({ success: false, message: 'Error fetching monthly sales' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

