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

        const [rows] = (await connection.query('SELECT * FROM tblPlataformas WHERE Status = 0 ORDER BY Orden ASC, Plataforma ASC');

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching platforms:', error);
        return NextResponse.json({ success: false, message: 'Error fetching platforms' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, platform, commission, order } = body;

        if (!projectId || !platform) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Status = 0 (Active), FechaAct = Now()
        const [result] = (await connection.query(
            'INSERT INTO tblPlataformas (Plataforma, Comision, Orden, Status, FechaAct) VALUES (?, ?, ?, 0, Now())',
            [platform, commission || 0, order || 0]
        );

        return NextResponse.json({
            success: true,
            message: 'Platform created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating platform:', error);
        return NextResponse.json({ success: false, message: 'Error creating platform' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

