import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, channel, commission, order } = body;

        if (!projectId || !channel) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        await connection.query(
            'UPDATE tblCanalesVenta SET CanalVenta = ?, Comision = ?, Orden = ?, FechaAct = Now() WHERE IdCanalVenta = ?',
            [channel, commission, order, id]
        );

        return NextResponse.json({ success: true, message: 'Sales channel updated successfully' });
    } catch (error) {
        console.error('Error updating sales channel:', error);
        return NextResponse.json({ success: false, message: 'Error updating sales channel' }, { status: 500 });
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
        await connection.query(
            'UPDATE tblCanalesVenta SET Status = 2, FechaAct = Now() WHERE IdCanalVenta = ?',
            [id]
        );

        return NextResponse.json({ success: true, message: 'Sales channel deleted successfully' });
    } catch (error) {
        console.error('Error deleting sales channel:', error);
        return NextResponse.json({ success: false, message: 'Error deleting sales channel' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
