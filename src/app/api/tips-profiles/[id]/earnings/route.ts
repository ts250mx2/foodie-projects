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
            `SELECT t.*, CASE WHEN t.IdPuesto = 0 THEN 'Default' ELSE p.Puesto END as PuestoNombre 
             FROM tblPerfilesPropinasIngresos t
             LEFT JOIN tblPuestos p ON t.IdPuesto = p.IdPuesto
             WHERE t.IdPerfilPropina = ?`,
            [id]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching earnings:', error);
        return NextResponse.json({ success: false, message: 'Error fetching earnings' }, { status: 500 });
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
        const { projectId, idPuesto, porcentaje, monto } = body;

        if (!projectId || idPuesto === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        // Using REPLACE INTO for upsert logic (works because of composite PK on IdPerfilPropina, IdPuesto)
        await connection.query(
            `REPLACE INTO tblPerfilesPropinasIngresos (IdPerfilPropina, IdPuesto, Porcentaje, Monto, FechaAct) 
             VALUES (?, ?, ?, ?, Now())`,
            [id, idPuesto, porcentaje ?? 0, monto ?? 0]
        );

        return NextResponse.json({ success: true, message: 'Earnings saved successfully' });
    } catch (error) {
        console.error('Error saving earnings:', error);
        return NextResponse.json({ success: false, message: 'Error saving earnings' }, { status: 500 });
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
        const idPuesto = searchParams.get('idPuesto');

        if (!projectIdStr || !idPuesto) {
            return NextResponse.json({ success: false, message: 'Project ID and Puesto ID are required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        await connection.query(
            'DELETE FROM tblPerfilesPropinasIngresos WHERE IdPerfilPropina = ? AND IdPuesto = ?',
            [id, idPuesto]
        );

        return NextResponse.json({ success: true, message: 'Earnings deleted successfully' });
    } catch (error) {
        console.error('Error deleting earnings:', error);
        return NextResponse.json({ success: false, message: 'Error deleting earnings' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
