import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import pool from '@/lib/db';
import { savePermissions } from '@/lib/permissions';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, name, positionId, branchId, phone, email, address, photo, username, password, isAdmin, salary, permissions } = body;

        if (!projectId || !name) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // 1. Update Employee
        const [result]: any = await connection.query(
            `UPDATE tblEmpleados 
             SET Empleado = ?, IdPuesto = ?, IdSucursal = ?, Telefonos = ?, CorreoElectronico = ?, Calle = ?, ArchivoFoto = ?, Sueldo = ?, FechaAct = Now() 
             WHERE IdEmpleado = ?`,
            [name, positionId || null, branchId || null, phone || null, email || null, address || null, photo || null, salary || 0, id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ success: false, message: 'Employee not found' }, { status: 404 });
        }

        // 2. Update Access Data if provided (dominio desde la BD maestra vía pool)
        if (username) {
            const [projectRows]: any = await pool.query(
                'SELECT DominioFG FROM tblProyectos WHERE IdProyecto = ?',
                [projectId]
            );
            const domain = projectRows.length > 0 ? (projectRows[0].DominioFG || '') : '';
            const fullLogin = `${username}@${domain}`;

            if (password) {
                await connection.query(
                    'UPDATE tblEmpleados SET Login = ?, Passwd = ?, EsAdministrador = ? WHERE IdEmpleado = ?',
                    [fullLogin, password, isAdmin ? 1 : 0, id]
                );
            } else {
                await connection.query(
                    'UPDATE tblEmpleados SET Login = ?, EsAdministrador = ? WHERE IdEmpleado = ?',
                    [fullLogin, isAdmin ? 1 : 0, id]
                );
            }
        }

        // 3. Guardar permisos de menú si se enviaron
        await savePermissions(connection, Number(id), permissions);

        return NextResponse.json({
            success: true,
            message: 'Employee updated successfully'
        });
    } catch (error) {
        console.error('Error updating employee:', error);
        return NextResponse.json({ success: false, message: 'Error updating employee' }, { status: 500 });
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
        const [result]: any = await connection.query(
            'UPDATE tblEmpleados SET Status = 1, FechaAct = Now() WHERE IdEmpleado = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ success: false, message: 'Employee not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Employee deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting employee:', error);
        return NextResponse.json({ success: false, message: 'Error deleting employee' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
