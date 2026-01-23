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

        const [rows] = (await connection.query('SELECT * FROM tblCanalesVenta WHERE Status = 0 ORDER BY Orden ASC, CanalVenta ASC');

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching sales channels:', error);
        return NextResponse.json({ success: false, message: 'Error fetching sales channels' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, channel, commission, order } = body;

        if (!projectId || !channel) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        const [result] = (await connection.query(
            'INSERT INTO tblCanalesVenta (CanalVenta, Comision, Orden, Status, FechaAct) VALUES (?, ?, ?, 0, Now())',
            [channel, commission || 0, order || 0]
        );

        return NextResponse.json({
            success: true,
            message: 'Sales channel created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating sales channel:', error);
        return NextResponse.json({ success: false, message: 'Error creating sales channel' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, channels } = body;

        if (!projectId || !Array.isArray(channels)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Update order for each channel
        await Promise.all(channels.map(async (channel: { IdCanalVenta: number; Orden: number }) => {
            await connection.query(
                'UPDATE tblCanalesVenta SET Orden = ? WHERE IdCanalVenta = ?',
                [channel.Orden, channel.IdCanalVenta]
            );
        }));

        return NextResponse.json({ success: true, message: 'Channels reordered successfully' });
    } catch (error) {
        console.error('Error reordering sales channels:', error);
        return NextResponse.json({ success: false, message: 'Error reordering sales channels' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

