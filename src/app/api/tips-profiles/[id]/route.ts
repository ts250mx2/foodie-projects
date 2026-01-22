import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, profileName } = body;

        if (!projectId || !profileName) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        await connection.query<ResultSetHeader>(
            'UPDATE tblPerfilesPropinas SET PerfilPropina = ?, EsActivo = ?, FechaAct = Now() WHERE IdPerfilPropina = ?',
            [profileName, body.esActivo !== undefined ? body.esActivo : 1, id]
        );

        return NextResponse.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json({ success: false, message: 'Error updating profile' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        // Soft delete: Status = 2
        await connection.query<ResultSetHeader>(
            'UPDATE tblPerfilesPropinas SET Status = 2, FechaAct = Now() WHERE IdPerfilPropina = ?',
            [id]
        );

        return NextResponse.json({ success: true, message: 'Profile deleted successfully' });
    } catch (error) {
        console.error('Error deleting profile:', error);
        return NextResponse.json({ success: false, message: 'Error deleting profile' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
