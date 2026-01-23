import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const hasTipsStr = searchParams.get('hasTips');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // Build query based on hasTips filter
        let query = 'SELECT * FROM tblPuestos WHERE Status = 0';
        if (hasTipsStr === '1') {
            query += ' AND TienePropina = 1';
        }
        query += ' ORDER BY Puesto ASC';

        const [rows] = await connection.query(query);

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching positions:', error);
        return NextResponse.json({ success: false, message: 'Error fetching positions' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, position, hasTips } = body;

        if (!projectId || !position) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Status = 0 (Active), FechaAct = Now(), TienePropina defaults to 0 if not provided
        const [result] = await connection.query(
            'INSERT INTO tblPuestos (Puesto, TienePropina, Status, FechaAct) VALUES (?, ?, 0, Now())',
            [position, hasTips ?? 0]
        );

        return NextResponse.json({
            success: true,
            message: 'Position created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating position:', error);
        return NextResponse.json({ success: false, message: 'Error creating position' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

