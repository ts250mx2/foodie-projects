import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, channelName } = body;

        if (!projectId || !channelName) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        await connection.query<ResultSetHeader>(
            'UPDATE tblCanalesPago SET CanalPago = ?, FechaAct = Now() WHERE IdCanalPago = ?',
            [channelName, id]
        );

        return NextResponse.json({ success: true, message: 'Payment channel updated successfully' });
    } catch (error) {
        console.error('Error updating payment channel:', error);
        return NextResponse.json({ success: false, message: 'Error updating payment channel' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let connection;
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // Soft delete: Status = 2 means deleted
        await connection.query<ResultSetHeader>(
            'UPDATE tblCanalesPago SET Status = 2, FechaAct = Now() WHERE IdCanalPago = ?',
            [id]
        );

        return NextResponse.json({ success: true, message: 'Payment channel deleted successfully' });
    } catch (error) {
        console.error('Error deleting payment channel:', error);
        return NextResponse.json({ success: false, message: 'Error deleting payment channel' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
