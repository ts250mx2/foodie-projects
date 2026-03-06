import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    let foodieProjectsConnection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, name, positionId, branchId, phone, email, address, photo, username, password, isAdmin } = body;

        if (!projectId || !name) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // 1. Update Employee
        const [result]: any = await connection.query(
            `UPDATE tblEmpleados 
             SET Empleado = ?, IdPuesto = ?, IdSucursal = ?, Telefonos = ?, CorreoElectronico = ?, Calle = ?, ArchivoFoto = ?, FechaAct = Now() 
             WHERE IdEmpleado = ?`,
            [name, positionId || null, branchId || null, phone || null, email || null, address || null, photo || null, id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ success: false, message: 'Employee not found' }, { status: 404 });
        }

        // 2. Update Access Data if provided
        if (username) {
            foodieProjectsConnection = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: 'BDFoodieProjects'
            });

            const [projectRows]: any = await foodieProjectsConnection.query(
                'SELECT DominioFG FROM tblProyectos WHERE IdProyecto = ?',
                [projectId]
            );

            if (projectRows.length > 0) {
                const domain = projectRows[0].DominioFG;
                const fullLogin = `${username}@${domain}`;

                if (password) {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    await connection.query(
                        'UPDATE tblEmpleados SET Login = ?, Passwd = ?, EsAdministrador = ? WHERE IdEmpleado = ?',
                        [fullLogin, hashedPassword, isAdmin ? 1 : 0, id]
                    );
                } else {
                    await connection.query(
                        'UPDATE tblEmpleados SET Login = ?, EsAdministrador = ? WHERE IdEmpleado = ?',
                        [fullLogin, isAdmin ? 1 : 0, id]
                    );
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Employee updated successfully'
        });
    } catch (error) {
        console.error('Error updating employee:', error);
        return NextResponse.json({ success: false, message: 'Error updating employee' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
        if (foodieProjectsConnection) await foodieProjectsConnection.end();
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
