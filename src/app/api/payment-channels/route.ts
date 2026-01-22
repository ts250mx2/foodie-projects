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

        const [rows] = await connection.query<RowDataPacket[]>('SELECT * FROM tblCanalesPago WHERE Status = 0 ORDER BY CanalPago ASC');

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching payment channels:', error);
        return NextResponse.json({ success: false, message: 'Error fetching payment channels' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, channelName } = body;

        if (!projectId || !channelName) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Status = 0 (Active), FechaAct = Now()
        const [result] = await connection.query<ResultSetHeader>(
            'INSERT INTO tblCanalesPago (CanalPago, Status, FechaAct) VALUES (?, 0, Now())',
            [channelName]
        );

        return NextResponse.json({
            success: true,
            message: 'Payment channel created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating payment channel:', error);
        return NextResponse.json({ success: false, message: 'Error creating payment channel' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
