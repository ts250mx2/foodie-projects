import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = searchParams.get('branchId');
        connection = await getProjectConnection(projectId);

        let query = `
            SELECT t.*, s.Sucursal 
            FROM tblTurnos t
            LEFT JOIN tblSucursales s ON t.IdSucursal = s.IdSucursal
            WHERE t.Status = 0 
        `;
        const queryParams: any[] = [];

        if (branchId) {
            query += ' AND t.IdSucursal = ? ';
            queryParams.push(branchId);
        }

        query += ' ORDER BY t.Turno ASC ';

        const [rows] = await connection.query<RowDataPacket[]>(query, queryParams);

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching shifts:', error);
        return NextResponse.json({ success: false, message: 'Error fetching shifts' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, shift, branchId, startTime, endTime } = body;

        if (!projectId || !shift || !branchId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Status = 0 (Active), FechaAct = Now()
        const [result] = await connection.query<ResultSetHeader>(
            'INSERT INTO tblTurnos (Turno, IdSucursal, HoraInicio, HoraFin, Status, FechaAct) VALUES (?, ?, ?, ?, 0, Now())',
            [shift, branchId, startTime || null, endTime || null]
        );

        return NextResponse.json({
            success: true,
            message: 'Shift created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating shift:', error);
        return NextResponse.json({ success: false, message: 'Error creating shift' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
