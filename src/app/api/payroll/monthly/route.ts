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

        // Get monthly payroll grouped by day and employee, filtered by branch
        const [rows] = await connection.query(
            `SELECT n.Dia as day, e.Empleado as employeeName, SUM(n.Pago) as total
             FROM tblNomina n
             LEFT JOIN tblEmpleados e ON n.IdUsuario = e.IdEmpleado
             WHERE n.Mes = ? AND n.Anio = ? AND e.IdSucursal = ?
             GROUP BY n.Dia, e.Empleado
             ORDER BY n.Dia, e.Empleado`,
            [monthNum, year, branchId]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching monthly payroll:', error);
        return NextResponse.json({ success: false, message: 'Error fetching monthly payroll' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

