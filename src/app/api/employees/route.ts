import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import pool from '@/lib/db';
import { savePermissions } from '@/lib/permissions';
import { ResultSetHeader } from 'mysql2';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        let query = `
            SELECT e.*, p.Puesto, s.Sucursal, tp.ImagenTipoPuesto
            FROM tblEmpleados e 
            LEFT JOIN BDFoodieProjects.tblPuestos p ON e.IdPuesto = p.IdPuesto 
            LEFT JOIN tblSucursales s ON e.IdSucursal = s.IdSucursal
            LEFT JOIN BDFoodieProjects.tblTiposPuestos tp ON p.IdTipoPuesto = tp.IdTipoPuesto
            WHERE e.Status = 0 
        `;
        const queryParams: any[] = [];

        /*if (branchIdStr) {
            query += ` AND e.IdSucursal = ? `;
            queryParams.push(parseInt(branchIdStr));
        }*/

        query += ` ORDER BY e.Empleado ASC `;
        console.log(query);
        console.log(branchIdStr);
        // Join with tblPuestos and tblSucursales to get position and branch names
        const [rows] = await connection.query(query, queryParams);

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching employees:', error);
        return NextResponse.json({ success: false, message: 'Error fetching employees' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, name, positionId, branchId, phone, email, address, photo, username, password, isAdmin, salary, permissions } = body;

        if (!projectId || !name) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // 1. Insert Employee
        const [result] = await connection.query(
            `INSERT INTO tblEmpleados (Empleado, IdPuesto, IdSucursal, Telefonos, CorreoElectronico, Calle, ArchivoFoto, Sueldo, Status, FechaAct) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, Now())`,
            [name, positionId || null, branchId || null, phone || null, email || null, address || null, photo || null, salary || 0]
        );

        const employeeId = (result as ResultSetHeader).insertId;

        // 2. Handle Access Data if provided (dominio desde la BD maestra vía pool)
        if (username) {
            const [projectRows]: any = await pool.query(
                'SELECT DominioFG FROM tblProyectos WHERE IdProyecto = ?',
                [projectId]
            );
            const domain = projectRows.length > 0 ? (projectRows[0].DominioFG || '') : '';
            const fullLogin = `${username}@${domain}`;

            if (password) {
                // Contraseña en texto plano (consistente con el login actual)
                await connection.query(
                    'UPDATE tblEmpleados SET Login = ?, Passwd = ?, EsAdministrador = ? WHERE IdEmpleado = ?',
                    [fullLogin, password, isAdmin ? 1 : 0, employeeId]
                );
            } else {
                await connection.query(
                    'UPDATE tblEmpleados SET Login = ?, EsAdministrador = ? WHERE IdEmpleado = ?',
                    [fullLogin, isAdmin ? 1 : 0, employeeId]
                );
            }
        }

        // 3. Guardar permisos de menú si se enviaron
        await savePermissions(connection, employeeId, permissions);

        return NextResponse.json({
            success: true,
            message: 'Employee created successfully',
            id: employeeId
        });
    } catch (error) {
        console.error('Error creating employee:', error);
        return NextResponse.json({ success: false, message: 'Error creating employee' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

