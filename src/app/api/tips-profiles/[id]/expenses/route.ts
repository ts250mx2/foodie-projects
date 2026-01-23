import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(
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

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        const [rows] = (await connection.query(
            'SELECT * FROM tblPerfilesPropinasEgresos WHERE IdPerfilPropina = ?',
            [id]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching tip expenses:', error);
        return NextResponse.json({ success: false, message: 'Error fetching tip expenses' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, concepto, porcentaje } = body;

        if (!projectId || !concepto) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        await connection.query(
            'INSERT INTO tblPerfilesPropinasEgresos (IdPerfilPropina, Concepto, Porcentaje, FechaAct) VALUES (?, ?, ?, Now())',
            [id, concepto, porcentaje ?? 0]
        );

        return NextResponse.json({ success: true, message: 'Expense saved successfully' });
    } catch (error) {
        console.error('Error saving tip expense:', error);
        return NextResponse.json({ success: false, message: 'Error saving tip expense' }, { status: 500 });
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
        const idEgreso = searchParams.get('idEgreso');

        if (!projectIdStr || !idEgreso) {
            return NextResponse.json({ success: false, message: 'Project ID and Expense ID are required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        await connection.query(
            'DELETE FROM tblPerfilesPropinasEgresos WHERE IdPerfilPropinaEgreso = ? AND IdPerfilPropina = ?',
            [idEgreso, id]
        );

        return NextResponse.json({ success: true, message: 'Expense deleted successfully' });
    } catch (error) {
        console.error('Error deleting tip expense:', error);
        return NextResponse.json({ success: false, message: 'Error deleting tip expense' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
