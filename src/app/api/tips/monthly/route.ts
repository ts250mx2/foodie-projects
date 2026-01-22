import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const branchId = searchParams.get('branchId');
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        if (!projectId || !branchId || !month || !year) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        connection = await getProjectConnection(parseInt(projectId));

        // Get monthly summary grouped by day and shift
        const [rows] = await connection.query(
            `SELECT 
                pe.Dia,
                t.Turno,
                SUM(pe.MontoPropina) as Total
            FROM tblPropinasEmpleados pe
            INNER JOIN tblTurnos t ON pe.IdTurno = t.IdTurno
            WHERE pe.IdSucursal = ? 
                AND pe.Mes = ? 
                AND pe.Anio = ?
            GROUP BY pe.Dia, pe.IdTurno, t.Turno
            ORDER BY pe.Dia, t.Turno`,
            [branchId, month, year]
        );

        // Transform data into calendar format
        const monthlyData: Record<number, Array<{ shiftName: string, total: number }>> = {};

        (rows as any[]).forEach((row: any) => {
            if (!monthlyData[row.Dia]) {
                monthlyData[row.Dia] = [];
            }
            monthlyData[row.Dia].push({
                shiftName: row.Turno,
                total: parseFloat(row.Total) || 0
            });
        });

        return NextResponse.json({ success: true, data: monthlyData });
    } catch (error: any) {
        console.error('Error fetching monthly tips:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) await connection.end();
    }
}
