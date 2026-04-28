import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, proveedor, rfc, telefonos, correoElectronico, calle, contacto, esProveedorGasto } = body;

        if (!projectId || !proveedor) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Check if supplier name already exists (excluding current ID)
        const [existing] = await connection.query(
            'SELECT IdProveedor FROM tblProveedores WHERE Proveedor = ? AND Status = 0 AND IdProveedor != ?',
            [proveedor, id]
        ) as [any[], any];

        if (existing.length > 0) {
            return NextResponse.json({ success: false, message: 'Ya existe un proveedor con este nombre' }, { status: 400 });
        }

        await connection.query(
            'UPDATE tblProveedores SET Proveedor = ?, RFC = ?, Telefonos = ?, CorreoElectronico = ?, Calle = ?, Contacto = ?, EsProveedorGasto = ?, FechaAct = Now() WHERE IdProveedor = ?',
            [proveedor, rfc || '', telefonos || '', correoElectronico || '', calle || '', contacto || '', esProveedorGasto ? 1 : 0, id]
        );

        return NextResponse.json({ success: true, message: 'Supplier updated successfully' });
    } catch (error) {
        console.error('Error updating supplier:', error);
        return NextResponse.json({ success: false, message: 'Error updating supplier' }, { status: 500 });
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
        await connection.query(
            'UPDATE tblProveedores SET Status = 2, FechaAct = Now() WHERE IdProveedor = ?',
            [id]
        );

        return NextResponse.json({ success: true, message: 'Supplier deleted successfully' });
    } catch (error) {
        console.error('Error deleting supplier:', error);
        return NextResponse.json({ success: false, message: 'Error deleting supplier' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
