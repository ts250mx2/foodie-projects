import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let connection;
    try {
        // Await params as per Next.js 15+ changes? Next 16 is even stricter.
        // User's project uses Next 16.0.10.
        const { id } = await params;
        const body = await request.json();
        const { projectId, terminal, commission } = body;

        if (!projectId || !terminal) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        await connection.query(
            'UPDATE tblTerminales SET Terminal = ?, Comision = ?, FechaAct = Now() WHERE IdTerminal = ?',
            [terminal, commission, id]
        );

        return NextResponse.json({ success: true, message: 'Terminal updated successfully' });
    } catch (error) {
        console.error('Error updating terminal:', error);
        return NextResponse.json({ success: false, message: 'Error updating terminal' }, { status: 500 });
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

        // Soft delete: Status = 2 means deleted as per user request
        await connection.query(
            'UPDATE tblTerminales SET Status = 2, FechaAct = Now() WHERE IdTerminal = ?',
            [id]
        );

        return NextResponse.json({ success: true, message: 'Terminal deleted successfully' });
    } catch (error) {
        console.error('Error deleting terminal:', error);
        return NextResponse.json({ success: false, message: 'Error deleting terminal' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
