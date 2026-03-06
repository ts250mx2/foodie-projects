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

        // Fetch active payment methods (Status != 2) for the specific branch
        const [rows] = await connection.query(
            `SELECT * FROM tblTerminales 
             WHERE IdSucursal = ? AND (Status != 2 OR Status IS NULL)
             ORDER BY Terminal ASC`,
            [id]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        return NextResponse.json({ success: false, message: 'Error fetching payment methods' }, { status: 500 });
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
        const { projectId, idTerminal, terminal, comision } = body;

        if (!projectId || !terminal) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        if (idTerminal) {
            // Update existing
            await connection.query(
                `UPDATE tblTerminales 
                 SET Terminal = ?, Comision = ?, FechaAct = Now() 
                 WHERE IdTerminal = ? AND IdSucursal = ?`,
                [terminal, comision || 0, idTerminal, id]
            );
        } else {
            // Insert new
            await connection.query(
                `INSERT INTO tblTerminales (Terminal, Comision, Status, IdSucursal, FechaAct) 
                 VALUES (?, ?, 0, ?, Now())`,
                [terminal, comision || 0, id]
            );
        }

        return NextResponse.json({ success: true, message: 'Payment method saved successfully' });
    } catch (error) {
        console.error('Error saving payment method:', error);
        return NextResponse.json({ success: false, message: 'Error saving payment method' }, { status: 500 });
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
        const idTerminal = searchParams.get('idTerminal');

        if (!projectIdStr || !idTerminal) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // Soft delete: Status = 2
        await connection.query(
            'UPDATE tblTerminales SET Status = 2, FechaAct = Now() WHERE IdTerminal = ? AND IdSucursal = ?',
            [idTerminal, id]
        );

        return NextResponse.json({ success: true, message: 'Payment method deleted successfully' });
    } catch (error) {
        console.error('Error deleting payment method:', error);
        return NextResponse.json({ success: false, message: 'Error deleting payment method' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
