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

        // Get daily payroll with employee names and TipoPago
        const [rows] = await connection.query(
            `SELECT n.Dia, n.Mes, n.Anio, n.IdUsuario, n.Pago, n.TipoPago, e.Empleado
             FROM tblNomina n
             INNER JOIN tblEmpleados e ON n.IdUsuario = e.IdEmpleado
             WHERE n.IdSucursal = ? AND n.Dia = ? AND n.Mes = ? AND n.Anio = ?
             ORDER BY n.FechaAct`,
            [branchId, day, monthNum, year]
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
        const { projectId, branchId, day, month, year, employeeId, amount, paymentType } = body;
        const type = paymentType || 'PAGO NOMINA';

        if (!projectId || !branchId || !day || month === null || !year || !employeeId || amount === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }


        const monthNum = month + 1; // Convert to 1-12 for SQL
        connection = await getProjectConnection(projectId);

        // Ensure TipoPago column exists
        try {
            await connection.query(`ALTER TABLE tblNomina ADD COLUMN TipoPago VARCHAR(50) DEFAULT 'PAGO NOMINA' AFTER Pago`);
        } catch (e: any) {
            // Ignore if column already exists (Error 1060)
            if (e.errno !== 1060 && e.code !== 'ER_DUP_FIELDNAME') {
                console.error('Error adding TipoPago column:', e);
            }
        }

        // Incremental: Add to existing amount if already exists for this employee/day/branch/type
        // We add TipoPago to the unique constraint check (implied by ON DUPLICATE KEY UPDATE)
        const [result] = await connection.query(
            `INSERT INTO tblNomina (Dia, Mes, Anio, IdUsuario, Pago, IdSucursal, TipoPago, FechaAct)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE Pago = Pago + VALUES(Pago), TipoPago = VALUES(TipoPago), FechaAct = NOW()`,
            [day, monthNum, year, employeeId, amount, branchId, type]
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

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const employeeIdStr = searchParams.get('employeeId');
        const day = searchParams.get('day');
        const month = searchParams.get('month'); // 0-11
        const year = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || !employeeIdStr || !day || month === null || !year) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const employeeId = parseInt(employeeIdStr);
        const monthNum = parseInt(month) + 1; // 1-12

        connection = await getProjectConnection(projectId);

        await connection.query(
            'DELETE FROM tblNomina WHERE IdSucursal = ? AND Dia = ? AND Mes = ? AND Anio = ? AND IdUsuario = ?',
            [branchId, day, monthNum, year, employeeId]
        );

        return NextResponse.json({ success: true, message: 'Payroll deleted successfully' });
    } catch (error) {
        console.error('Error deleting payroll:', error);
        return NextResponse.json({ success: false, message: 'Error deleting payroll' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
