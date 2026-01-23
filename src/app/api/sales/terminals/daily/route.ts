import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const dayStr = searchParams.get('day');
        const monthStr = searchParams.get('month');
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || !dayStr || monthStr === null || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        const [rows] = (await connection.query(
            `SELECT v.*, t.Turno, ter.Terminal, ter.Comision,
                    (v.Venta * ter.Comision / 100) as ComisionMonto
             FROM tblVentasTerminales v
             JOIN tblTurnos t ON v.IdTurno = t.IdTurno
             JOIN tblTerminales ter ON v.IdTerminal = ter.IdTerminal
             WHERE v.IdSucursal = ? AND v.Dia = ? AND v.Mes = ? AND v.Anio = ?`,
            [branchIdStr, dayStr, monthStr, yearStr]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching daily terminal sales:', error);
        return NextResponse.json({ success: false, message: 'Error fetching daily terminal sales' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, day, month, year, shiftId, terminalId, amount } = body;

        if (!projectId || !branchId || !shiftId || !terminalId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        await connection.query(
            `INSERT INTO tblVentasTerminales (Dia, Mes, Anio, IdTurno, IdTerminal, IdSucursal, Venta, FechaAct)
             VALUES (?, ?, ?, ?, ?, ?, ?, Now())
             ON DUPLICATE KEY UPDATE Venta = VALUES(Venta), FechaAct = Now()`,
            [day, month, year, shiftId, terminalId, branchId, amount]
        );

        return NextResponse.json({ success: true, message: 'Sale saved successfully' });
    } catch (error) {
        console.error('Error saving terminal sale:', error);
        return NextResponse.json({ success: false, message: 'Error saving terminal sale' }, { status: 500 });
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
        const dayStr = searchParams.get('day');
        const monthStr = searchParams.get('month');
        const yearStr = searchParams.get('year');
        const shiftIdStr = searchParams.get('shiftId');
        const terminalIdStr = searchParams.get('terminalId');

        if (!projectIdStr || !branchIdStr || !dayStr || monthStr === null || !yearStr || !shiftIdStr || !terminalIdStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        await connection.query(
            `DELETE FROM tblVentasTerminales
             WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdTurno = ? AND IdTerminal = ? AND IdSucursal = ?`,
            [dayStr, monthStr, yearStr, shiftIdStr, terminalIdStr, branchIdStr]
        );

        return NextResponse.json({ success: true, message: 'Sale deleted successfully' });
    } catch (error) {
        console.error('Error deleting terminal sale:', error);
        return NextResponse.json({ success: false, message: 'Error deleting terminal sale' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

