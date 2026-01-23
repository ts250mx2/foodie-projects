import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const month = searchParams.get('month'); // 0-11
        const year = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || month === null || !year) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const monthNum = parseInt(month) + 1; // Convert to 1-12 for SQL
        connection = await getProjectConnection(projectId);

        // Get monthly expenses grouped by day and concept
        const [rows] = await connection.query(
            `SELECT g.Dia as day, c.ConceptoGasto as conceptName, SUM(g.Gasto) as total
             FROM tblGastos g
             LEFT JOIN tblConceptosGastos c ON g.IdConceptoGasto = c.IdConceptoGasto
             WHERE g.Mes = ? AND g.Anio = ? AND g.IdSucursal = ?
             GROUP BY g.Dia, c.ConceptoGasto
             ORDER BY g.Dia, c.ConceptoGasto`,
            [monthNum, year, branchId]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching monthly expenses:', error);
        return NextResponse.json({ success: false, message: 'Error fetching monthly expenses' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

