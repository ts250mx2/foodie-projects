import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const branchId = searchParams.get('branchId');
        const day = searchParams.get('day');
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        if (!projectId || !branchId || !day || !month || !year) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        connection = await getProjectConnection(parseInt(projectId));

        const [rows] = await connection.query(
            `SELECT 
                pe.IdEmpleado,
                e.Empleado,
                pe.IdTurno,
                t.Turno,
                pe.IdPerfilPropina,
                pp.PerfilPropina,
                pe.Venta,
                pe.Porcentaje,
                pe.Monto,
                pe.MontoPropina
            FROM tblPropinasEmpleados pe
            INNER JOIN tblEmpleados e ON pe.IdEmpleado = e.IdEmpleado
            INNER JOIN tblTurnos t ON pe.IdTurno = t.IdTurno
            INNER JOIN tblPerfilesPropinas pp ON pe.IdPerfilPropina = pp.IdPerfilPropina
            WHERE pe.IdSucursal = ? 
                AND pe.Dia = ? 
                AND pe.Mes = ? 
                AND pe.Anio = ?
            ORDER BY t.Turno, e.Empleado`,
            [branchId, day, month, year]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error: any) {
        console.error('Error fetching daily tips:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const {
            projectId,
            employeeId,
            branchId,
            shiftId,
            day,
            month,
            year,
            profileId,
            sales,
            percentage,
            amount
        } = body;

        if (!projectId || !employeeId || !branchId || !shiftId || !day || !month || !year || !profileId || sales === undefined) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Calculate tip amount
        const tipAmount = (parseFloat(sales) * parseFloat(percentage) / 100) + parseFloat(amount);

        connection = await getProjectConnection(parseInt(projectId));

        // Use REPLACE INTO for upsert logic
        await connection.query(
            `REPLACE INTO tblPropinasEmpleados 
            (IdEmpleado, IdSucursal, IdTurno, Dia, Mes, Anio, IdPerfilPropina, Venta, Porcentaje, Monto, MontoPropina, FechaAct)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, Now())`,
            [employeeId, branchId, shiftId, day, month, year, profileId, sales, percentage, amount, tipAmount]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error saving tip:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const employeeId = searchParams.get('employeeId');
        const branchId = searchParams.get('branchId');
        const shiftId = searchParams.get('shiftId');
        const day = searchParams.get('day');
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        if (!projectId || !employeeId || !branchId || !shiftId || !day || !month || !year) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        connection = await getProjectConnection(parseInt(projectId));

        await connection.query(
            `DELETE FROM tblPropinasEmpleados 
            WHERE IdEmpleado = ? 
                AND IdSucursal = ? 
                AND IdTurno = ? 
                AND Dia = ? 
                AND Mes = ? 
                AND Anio = ?`,
            [employeeId, branchId, shiftId, day, month, year]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting tip:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    } finally {
        if (connection) await connection.end();
    }
}
