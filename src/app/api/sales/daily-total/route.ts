import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const dayStr = searchParams.get('day');
        const monthStr = searchParams.get('month');
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || monthStr === null || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        let query = `SELECT Dia as day, Ventas as sales FROM tblVentasDia 
                     WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`;
        const params: any[] = [branchIdStr, monthStr, yearStr];

        if (dayStr) {
            query += ` AND Dia = ?`;
            params.push(dayStr);
        }

        const [rows] = await connection.query(query, params);

        if (dayStr) {
            const sales = (rows as RowDataPacket[])[0]?.sales || 0;
            return NextResponse.json({ success: true, data: { sales } });
        }

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching daily total sales:', error);
        return NextResponse.json({ success: false, message: 'Error fetching daily total sales' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, day, month, year, amount } = body;

        if (!projectId || !branchId || day === undefined || month === undefined || year === undefined || amount === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        await connection.query(
            `REPLACE INTO tblVentasDia (IdSucursal, Dia, Mes, Anio, Ventas, FechaAct)
             VALUES (?, ?, ?, ?, ?, Now())`,
            [branchId, day, month, year, amount]
        );

        return NextResponse.json({ success: true, message: 'Daily total sale saved successfully' });
    } catch (error) {
        console.error('Error saving daily total sale:', error);
        return NextResponse.json({ success: false, message: 'Error saving daily total sale' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
