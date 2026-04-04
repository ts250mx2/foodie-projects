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
        const month = parseInt(monthStr);
        const year = parseInt(yearStr);

        connection = await getProjectConnection(projectId);

        // 1. Total Sales (from tblVentasCanalesVenta for consistency)
        const [totalSalesRows] = (await connection.query(
            `SELECT SUM(Venta) as total 
             FROM tblVentasCanalesVenta 
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchId, month, year]
        )) as [RowDataPacket[], FieldPacket[]];
        const totalSales = totalSalesRows[0]?.total || 0;

        // 2. Group by Channel
        const [channelRows] = (await connection.query(
            `SELECT c.CanalVenta as name, SUM(v.Venta) as value, COUNT(*) as count
             FROM tblVentasCanalesVenta v
             JOIN tblCanalesVenta c ON v.IdCanalVenta = c.IdCanalVenta
             WHERE v.IdSucursal = ? AND v.Mes = ? AND v.Anio = ?
             GROUP BY c.CanalVenta`,
            [branchId, month, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // 3. Group by Shift
        const [shiftRows] = (await connection.query(
            `SELECT t.Turno as name, SUM(v.Venta) as value, COUNT(*) as count
             FROM tblVentasCanalesVenta v
             JOIN tblTurnos t ON v.IdTurno = t.IdTurno
             WHERE v.IdSucursal = ? AND v.Mes = ? AND v.Anio = ?
             GROUP BY t.Turno`,
            [branchId, month, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // 4. Group by Payment Method (Terminals + Cash)
        const [terminalRows] = (await connection.query(
            `SELECT ter.Terminal as name, SUM(v.Venta) as value, COUNT(*) as count
             FROM tblVentasTerminales v
             JOIN tblTerminales ter ON v.IdTerminal = ter.IdTerminal
             WHERE v.IdSucursal = ? AND v.Mes = ? AND v.Anio = ?
             GROUP BY ter.Terminal`,
            [branchId, month, year]
        )) as [RowDataPacket[], FieldPacket[]];

        const totalTerminalSales = terminalRows.reduce((acc, row) => acc + (row.value || 0), 0);
        const cashSales = totalSales - totalTerminalSales;

        const paymentRows = [...terminalRows] as any[];
        if (cashSales > 0 || totalTerminalSales === 0) {
            paymentRows.push({
                name: 'Efectivo',
                value: Math.max(0, cashSales),
                count: 0 // We don't have a specific count for cash transactions in these tables easily
            });
        }

        // 5. Group by Day
        const [dayRows] = (await connection.query(
            `SELECT CAST(Dia AS CHAR) as name, SUM(Venta) as value, COUNT(*) as count
             FROM tblVentasCanalesVenta
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?
             GROUP BY Dia
             ORDER BY Dia ASC`,
            [branchId, month, year]
        )) as [RowDataPacket[], FieldPacket[]];

        return NextResponse.json({
            success: true,
            data: {
                channels: channelRows,
                shifts: shiftRows,
                payments: paymentRows,
                days: dayRows,
                totalSales
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard sales details:', error);
        return NextResponse.json({ success: false, message: 'Error fetching dashboard sales details' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
