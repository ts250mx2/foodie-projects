import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const dayStr = searchParams.get('day');
        const monthStr = searchParams.get('month'); // 0-11
        const yearStr = searchParams.get('year');
        const branchIdStr = searchParams.get('branchId');

        if (!projectIdStr || !dayStr || !monthStr || !yearStr || !branchIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const day = parseInt(dayStr);
        const month = parseInt(monthStr);
        const year = parseInt(yearStr);
        const branchId = parseInt(branchIdStr);

        connection = await getProjectConnection(projectId);

        // Required SQL:
        // SELECT B.Turno, C.Terminal, D.Plataforma, A.Venta 
        // FROM tblVentas A 
        // INNER JOIN tblTurnos B ON A.IdTurno = B.IdTurno 
        // INNER JOIN tblTerminales C ON A.IdTerminal = C.IdTerminal 
        // INNER JOIN tblPlataformas D ON A.IdPlataforma = D.IdPlataforma 
        // ORDER BY A.IdTurno, C.Terminal, D.Plataforma

        const query = `
            SELECT 
                A.IdTurno, B.Turno, 
                A.IdTerminal, C.Terminal, 
                A.IdPlataforma, D.Plataforma, 
                A.Venta
            FROM tblVentas A
            INNER JOIN tblTurnos B ON A.IdTurno = B.IdTurno
            INNER JOIN tblTerminales C ON A.IdTerminal = C.IdTerminal
            INNER JOIN tblPlataformas D ON A.IdPlataforma = D.IdPlataforma
            WHERE A.Dia = ? AND A.Mes = ? AND A.Anio = ? AND A.IdSucursal = ?
            ORDER BY A.IdTurno, C.Terminal, D.Plataforma
        `;

        const [rows] = (await connection.query(query, [day, month, year, branchId]);

        return NextResponse.json({ success: true, data: rows });

    } catch (error) {
        console.error('Error fetching daily sales:', error);
        return NextResponse.json({ success: false, message: 'Error fetching sales' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, day, month, year, branchId, shiftId, terminalId, platformId, amount } = body;

        if (!projectId || !branchId || !shiftId || !terminalId || !platformId || amount === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Upsert query
        const query = `
            INSERT INTO tblVentas 
            (Dia, Mes, Anio, IdTurno, IdTerminal, IdPlataforma, IdSucursal, Venta, FechaAct)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
            Venta = VALUES(Venta),
            FechaAct = NOW()
        `;

        await connection.query(query, [
            day, month, year, shiftId, terminalId, platformId, branchId, amount
        ]);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error saving sale:', error);
        return NextResponse.json({ success: false, message: 'Error saving sale' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

