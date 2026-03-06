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

        // Fetch active sales channels (Status != 2) for the specific branch
        // Note: Adding IdSucursal column if not exists might be needed, but we'll assume it exists or should.
        const [rows] = await connection.query(
            `SELECT * FROM tblCanalesVenta 
             WHERE IdSucursal = ? AND (Status != 2 OR Status IS NULL)
             ORDER BY Orden ASC, CanalVenta ASC`,
            [id]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching sales channels:', error);
        return NextResponse.json({ success: false, message: 'Error fetching sales channels' }, { status: 500 });
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
        const { projectId, idCanalVenta, canalVenta, comision, orden } = body;

        if (!projectId || !canalVenta) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        if (idCanalVenta) {
            // Update existing
            await connection.query(
                `UPDATE tblCanalesVenta 
                 SET CanalVenta = ?, Comision = ?, Orden = ?, FechaAct = Now() 
                 WHERE IdCanalVenta = ? AND IdSucursal = ?`,
                [canalVenta, comision || 0, orden || 0, idCanalVenta, id]
            );
        } else {
            // Insert new
            await connection.query(
                `INSERT INTO tblCanalesVenta (CanalVenta, Comision, Orden, Status, IdSucursal, FechaAct) 
                 VALUES (?, ?, ?, 0, ?, Now())`,
                [canalVenta, comision || 0, orden || 0, id]
            );
        }

        return NextResponse.json({ success: true, message: 'Sales channel saved successfully' });
    } catch (error) {
        console.error('Error saving sales channel:', error);
        return NextResponse.json({ success: false, message: 'Error saving sales channel' }, { status: 500 });
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
        const idCanalVenta = searchParams.get('idCanalVenta');

        if (!projectIdStr || !idCanalVenta) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // Soft delete: Status = 2
        await connection.query(
            'UPDATE tblCanalesVenta SET Status = 2, FechaAct = Now() WHERE IdCanalVenta = ? AND IdSucursal = ?',
            [idCanalVenta, id]
        );

        return NextResponse.json({ success: true, message: 'Sales channel deleted successfully' });
    } catch (error) {
        console.error('Error deleting sales channel:', error);
        return NextResponse.json({ success: false, message: 'Error deleting sales channel' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
