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
        const startDate = searchParams.get('startDate'); // YYYY-MM-DD
        const endDate = searchParams.get('endDate'); // YYYY-MM-DD

        if (!projectIdStr || !branchIdStr || (monthStr === null && !startDate)) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        connection = await getProjectConnection(projectId);

        let whereClause = `n.IdSucursal = ? AND n.Mes = ? AND n.Anio = ?`;
        let params: (number | string)[] = [branchId, parseInt(monthStr || '0') + 1, parseInt(yearStr || '0')];

        if (startDate && endDate) {
            whereClause = `n.IdSucursal = ? AND DATE(CONCAT(n.Anio, '-', n.Mes, '-', n.Dia)) BETWEEN ? AND ?`;
            params = [branchId, startDate, endDate];
        }

        // 1. Total Payroll
        const [totalPayrollRows] = (await connection.query(
            `SELECT SUM(Pago) as total 
             FROM tblNomina n
             WHERE ${whereClause}`,
            params
        )) as [RowDataPacket[], FieldPacket[]];
        const totalPayroll = totalPayrollRows[0]?.total || 0;

        // 2. Group by Position
        const [positionRows] = (await connection.query(
            `SELECT p.Puesto as name, SUM(n.Pago) as value, COUNT(DISTINCT n.IdUsuario) as count
             FROM tblNomina n
             JOIN tblEmpleados e ON n.IdUsuario = e.IdEmpleado
             JOIN BDFoodieProjects.tblPuestos p ON e.IdPuesto = p.IdPuesto
             WHERE ${whereClause}
             GROUP BY p.Puesto`,
            params
        )) as [RowDataPacket[], FieldPacket[]];

        // 3. Group by Employee
        const [employeeRows] = (await connection.query(
            `SELECT e.Empleado as name, SUM(n.Pago) as value, COUNT(*) as count
             FROM tblNomina n
             JOIN tblEmpleados e ON n.IdUsuario = e.IdEmpleado
             WHERE ${whereClause}
             GROUP BY e.Empleado`,
            params
        )) as [RowDataPacket[], FieldPacket[]];

        // 4. Group by Day
        const dateExpr = (startDate && endDate) ? `CONCAT(n.Dia, '/', n.Mes)` : `CAST(n.Dia AS CHAR)`;
        const [dayRows] = (await connection.query(
            `SELECT ${dateExpr} as name, SUM(n.Pago) as value, COUNT(*) as count
             FROM tblNomina n
             WHERE ${whereClause}
             GROUP BY n.Anio, n.Mes, n.Dia
             ORDER BY n.Anio ASC, n.Mes ASC, n.Dia ASC`,
            params
        )) as [RowDataPacket[], FieldPacket[]];

        return NextResponse.json({
            success: true,
            data: {
                positions: positionRows,
                employees: employeeRows,
                days: dayRows,
                totalPayroll
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard payroll details:', error);
        return NextResponse.json({ success: false, message: 'Error fetching dashboard payroll details' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
