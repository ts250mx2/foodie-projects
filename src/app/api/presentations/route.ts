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
        connection = await getProjectConnection(projectId);

        const [rows] = await connection.query('SELECT * FROM tblPresentaciones WHERE Status = 0 ORDER BY Presentacion ASC');

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching presentations:', error);
        return NextResponse.json({ success: false, message: 'Error fetching presentations' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, presentation } = body;

        if (!projectId || !presentation) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Status = 0 (Active), FechaAct = Now()
        const [result] = await connection.query(
            'INSERT INTO tblPresentaciones (Presentacion, Status, FechaAct) VALUES (?, 0, Now())',
            [presentation]
        );

        return NextResponse.json({
            success: true,
            message: 'Presentation created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating presentation:', error);
        return NextResponse.json({ success: false, message: 'Error creating presentation' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

