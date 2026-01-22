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

        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT * FROM tblSucursalesInventarios 
             WHERE IdSucursal = ? 
             ORDER BY FechaInventario DESC`,
            [id]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching inventory dates:', error);
        return NextResponse.json({ success: false, message: 'Error fetching inventory dates' }, { status: 500 });
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
        const { projectId, date } = body;

        if (!projectId || !date) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const inventoryDate = new Date(date);
        const dia = inventoryDate.getDate();
        const mes = inventoryDate.getMonth() + 1;
        const anio = inventoryDate.getFullYear();

        connection = await getProjectConnection(projectId);

        await connection.query<ResultSetHeader>(
            `REPLACE INTO tblSucursalesInventarios (IdSucursal, Dia, Mes, Anio, FechaInventario, FechaAct) 
             VALUES (?, ?, ?, ?, ?, Now())`,
            [id, dia, mes, anio, date]
        );

        return NextResponse.json({
            success: true,
            message: 'Inventory date saved successfully'
        });
    } catch (error) {
        console.error('Error saving inventory date:', error);
        return NextResponse.json({ success: false, message: 'Error saving inventory date' }, { status: 500 });
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
        const dia = searchParams.get('dia');
        const mes = searchParams.get('mes');
        const anio = searchParams.get('anio');

        if (!projectIdStr || !dia || !mes || !anio) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        await connection.query(
            'DELETE FROM tblSucursalesInventarios WHERE IdSucursal = ? AND Dia = ? AND Mes = ? AND Anio = ?',
            [id, dia, mes, anio]
        );

        return NextResponse.json({ success: true, message: 'Inventory date deleted successfully' });
    } catch (error) {
        console.error('Error deleting inventory date:', error);
        return NextResponse.json({ success: false, message: 'Error deleting inventory date' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
