import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const day = searchParams.get('day');
        const month = searchParams.get('month'); // 0-11
        const year = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || !day || month === null || !year) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const monthNum = parseInt(month) + 1; // Convert to 1-12 for SQL
        connection = await getProjectConnection(projectId);

        // Get daily payroll with employee names, filtered by branch
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT n.*, e.Empleado
             FROM tblNomina n
             LEFT JOIN tblEmpleados e ON n.IdUsuario = e.IdEmpleado
             WHERE n.Dia = ? AND n.Mes = ? AND n.Anio = ? AND e.IdSucursal = ?
             ORDER BY e.Empleado`,
            [day, monthNum, year, branchId]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching daily payroll:', error);
        return NextResponse.json({ success: false, message: 'Error fetching daily payroll' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, day, month, year, employeeId, amount } = body;

        if (!projectId || !branchId || !day || month === null || !year || !employeeId || amount === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const monthNum = month + 1; // Convert to 1-12 for SQL
        connection = await getProjectConnection(projectId);

        // Insert or update payroll record
        const [result] = await connection.query<ResultSetHeader>(
            `INSERT INTO tblNomina (Dia, Mes, Anio, IdUsuario, Pago, FechaAct)
             VALUES (?, ?, ?, ?, ?, Now())
             ON DUPLICATE KEY UPDATE Pago = Pago + ?, FechaAct = Now()`,
            [day, monthNum, year, employeeId, amount, amount]
        );

        return NextResponse.json({
            success: true,
            message: 'Payroll saved successfully'
        });
    } catch (error) {
        console.error('Error saving payroll:', error);
        return NextResponse.json({ success: false, message: 'Error saving payroll' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
