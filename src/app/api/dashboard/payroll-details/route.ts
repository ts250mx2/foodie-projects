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
        const monthNum = parseInt(monthStr) + 1; // 1-12 for tblNomina
        const year = parseInt(yearStr);

        connection = await getProjectConnection(projectId);

        // 1. Total Payroll
        const [totalPayrollRows] = (await connection.query(
            `SELECT SUM(Pago) as total 
             FROM tblNomina 
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];
        const totalPayroll = totalPayrollRows[0]?.total || 0;

        // 2. Group by Position
        const [positionRows] = (await connection.query(
            `SELECT p.Puesto as name, SUM(n.Pago) as value, COUNT(DISTINCT n.IdUsuario) as count
             FROM tblNomina n
             JOIN tblEmpleados e ON n.IdUsuario = e.IdEmpleado
             JOIN BDFoodieProjects.tblPuestos p ON e.IdPuesto = p.IdPuesto
             WHERE n.IdSucursal = ? AND n.Mes = ? AND n.Anio = ?
             GROUP BY p.Puesto`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // 3. Group by Employee
        const [employeeRows] = (await connection.query(
            `SELECT e.Empleado as name, SUM(n.Pago) as value, COUNT(*) as count
             FROM tblNomina n
             JOIN tblEmpleados e ON n.IdUsuario = e.IdEmpleado
             WHERE n.IdSucursal = ? AND n.Mes = ? AND n.Anio = ?
             GROUP BY e.Empleado`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // 4. Group by Day
        const [dayRows] = (await connection.query(
            `SELECT CAST(n.Dia AS CHAR) as name, SUM(n.Pago) as value, COUNT(*) as count
             FROM tblNomina n
             WHERE n.IdSucursal = ? AND n.Mes = ? AND n.Anio = ?
             GROUP BY n.Dia
             ORDER BY n.Dia ASC`,
            [branchId, monthNum, year]
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
