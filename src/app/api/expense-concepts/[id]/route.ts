import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, concept, requiredReference, paymentChannelId } = body;

        if (!projectId || !concept) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        await connection.query<ResultSetHeader>(
            'UPDATE tblConceptosGastos SET ConceptoGasto = ?, ReferenciaObligatoria = ?, IdCanalPago = ?, FechaAct = Now() WHERE IdConceptoGasto = ?',
            [concept, requiredReference || 0, paymentChannelId || null, id]
        );

        return NextResponse.json({ success: true, message: 'Expense concept updated successfully' });
    } catch (error) {
        console.error('Error updating expense concept:', error);
        return NextResponse.json({ success: false, message: 'Error updating expense concept' }, { status: 500 });
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
            'UPDATE tblConceptosGastos SET Status = 2, FechaAct = Now() WHERE IdConceptoGasto = ?',
            [id]
        );

        return NextResponse.json({ success: true, message: 'Expense concept deleted successfully' });
    } catch (error) {
        console.error('Error deleting expense concept:', error);
        return NextResponse.json({ success: false, message: 'Error deleting expense concept' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
