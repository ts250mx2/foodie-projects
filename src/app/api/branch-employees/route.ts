import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection: any;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');

        if (!projectIdStr || !branchIdStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        const [rows] = (await connection.query(
            `SELECT se.IdEmpleado, e.Empleado, p.Puesto, p.IdPuesto
             FROM tblSucursalesEmpleados se
             INNER JOIN tblEmpleados e ON se.IdEmpleado = e.IdEmpleado
             INNER JOIN tblPuestos p ON e.IdPuesto = p.IdPuesto
             WHERE se.IdSucursal = ?
             ORDER BY e.Empleado`,
            [branchIdStr]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching branch employees:', error);
        return NextResponse.json({ success: false, message: 'Error fetching branch employees' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection: any;
    try {
        const body = await request.json();
        const { projectId, branchId, employeeId } = body;

        if (!projectId || !branchId || !employeeId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        await connection.query(
            `INSERT INTO tblSucursalesEmpleados (IdSucursal, IdEmpleado, FechaAct)
             VALUES (?, ?, Now())
             ON DUPLICATE KEY UPDATE FechaAct = Now()`,
            [branchId, employeeId]
        );

        return NextResponse.json({ success: true, message: 'Employee added successfully' });
    } catch (error) {
        console.error('Error adding branch employee:', error);
        return NextResponse.json({ success: false, message: 'Error adding branch employee' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection: any;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const employeeIdStr = searchParams.get('employeeId');

        if (!projectIdStr || !branchIdStr || !employeeIdStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        await connection.query(
            `DELETE FROM tblSucursalesEmpleados
             WHERE IdSucursal = ? AND IdEmpleado = ?`,
            [branchIdStr, employeeIdStr]
        );

        return NextResponse.json({ success: true, message: 'Employee removed successfully' });
    } catch (error) {
        console.error('Error removing branch employee:', error);
        return NextResponse.json({ success: false, message: 'Error removing branch employee' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
