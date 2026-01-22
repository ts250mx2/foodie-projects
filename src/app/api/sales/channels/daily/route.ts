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

        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT v.*, t.Turno, c.CanalVenta
             FROM tblVentasCanalesVenta v
             JOIN tblTurnos t ON v.IdTurno = t.IdTurno
             JOIN tblCanalesVenta c ON v.IdCanalVenta = c.IdCanalVenta
             WHERE v.IdSucursal = ? AND v.Dia = ? AND v.Mes = ? AND v.Anio = ?`,
            [branchIdStr, dayStr, monthStr, yearStr]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching daily channel sales:', error);
        return NextResponse.json({ success: false, message: 'Error fetching daily channel sales' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, day, month, year, shiftId, channelId, amount } = body;

        if (!projectId || !branchId || !shiftId || !channelId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        // Use REPLACE INTO or similar? Standard is PK based check.
        await connection.query<ResultSetHeader>(
            `INSERT INTO tblVentasCanalesVenta (Dia, Mes, Anio, IdTurno, IdCanalVenta, IdSucursal, Venta, FechaAct)
             VALUES (?, ?, ?, ?, ?, ?, ?, Now())
             ON DUPLICATE KEY UPDATE Venta = VALUES(Venta), FechaAct = Now()`,
            [day, month, year, shiftId, channelId, branchId, amount]
        );

        return NextResponse.json({ success: true, message: 'Sale saved successfully' });
    } catch (error) {
        console.error('Error saving channel sale:', error);
        return NextResponse.json({ success: false, message: 'Error saving channel sale' }, { status: 500 });
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
        const channelIdStr = searchParams.get('channelId');

        if (!projectIdStr || !branchIdStr || !dayStr || monthStr === null || !yearStr || !shiftIdStr || !channelIdStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        await connection.query<ResultSetHeader>(
            `DELETE FROM tblVentasCanalesVenta
             WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdTurno = ? AND IdCanalVenta = ? AND IdSucursal = ?`,
            [dayStr, monthStr, yearStr, shiftIdStr, channelIdStr, branchIdStr]
        );

        return NextResponse.json({ success: true, message: 'Sale deleted successfully' });
    } catch (error) {
        console.error('Error deleting channel sale:', error);
        return NextResponse.json({ success: false, message: 'Error deleting channel sale' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
