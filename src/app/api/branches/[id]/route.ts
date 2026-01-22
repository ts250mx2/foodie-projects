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
        const { projectId, branch, phone, email, address, managerId } = body;

        if (!projectId || !branch) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        const [result] = await connection.query<ResultSetHeader>(
            `UPDATE tblSucursales 
             SET Sucursal = ?, Telefonos = ?, CorreoElectronico = ?, Calle = ?, IdEmpleadoGerente = ?, FechaAct = Now() 
             WHERE IdSucursal = ?`,
            [branch, phone || null, email || null, address || null, managerId || null, id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ success: false, message: 'Branch not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Branch updated successfully'
        });
    } catch (error) {
        console.error('Error updating branch:', error);
        return NextResponse.json({ success: false, message: 'Error updating branch' }, { status: 500 });
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

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // Soft delete: Set Status = 1
        const [result] = await connection.query<ResultSetHeader>(
            'UPDATE tblSucursales SET Status = 1, FechaAct = Now() WHERE IdSucursal = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ success: false, message: 'Branch not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Branch deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting branch:', error);
        return NextResponse.json({ success: false, message: 'Error deleting branch' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
