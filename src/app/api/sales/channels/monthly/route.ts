import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const monthStr = searchParams.get('month');
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || monthStr === null || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT v.Dia as day, t.Turno as shiftName, 
                    SUM(v.Venta) as total,
                    SUM(v.Venta * COALESCE(c.Comision, 0) / 100) as commission
             FROM tblVentasCanalesVenta v
             JOIN tblTurnos t ON v.IdTurno = t.IdTurno
             LEFT JOIN tblCanalesVenta c ON v.IdCanalVenta = c.IdCanalVenta
             WHERE v.IdSucursal = ? AND v.Mes = ? AND v.Anio = ?
             GROUP BY v.Dia, t.Turno`,
            [branchIdStr, monthStr, yearStr]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching monthly channel sales:', error);
        return NextResponse.json({ success: false, message: 'Error fetching monthly channel sales' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
