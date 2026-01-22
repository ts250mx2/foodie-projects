import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, documentType } = body;

        if (!projectId || !documentType) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        await connection.query<ResultSetHeader>(
            'UPDATE tblTiposDocumentos SET TipoDocumento = ?, FechaAct = Now() WHERE IdTipoDocumento = ?',
            [documentType, id]
        );

        return NextResponse.json({ success: true, message: 'Document type updated successfully' });
    } catch (error) {
        console.error('Error updating document type:', error);
        return NextResponse.json({ success: false, message: 'Error updating document type' }, { status: 500 });
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
            'UPDATE tblTiposDocumentos SET Status = 2, FechaAct = Now() WHERE IdTipoDocumento = ?',
            [id]
        );

        return NextResponse.json({ success: true, message: 'Document type deleted successfully' });
    } catch (error) {
        console.error('Error deleting document type:', error);
        return NextResponse.json({ success: false, message: 'Error deleting document type' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
