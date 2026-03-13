import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import mysql from 'mysql2/promise';
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
    let foodieProjectsConnection;
    try {
        const body = await request.json();
        const { projectId, name, positionId, branchId, phone, email, address, photo, username, password, isAdmin, salary } = body;

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

        // 2. Handle Access Data if provided
        if (username && password) {
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
                const hashedPassword = await bcrypt.hash(password, 10);

                await connection.query(
                    'UPDATE tblEmpleados SET Login = ?, Passwd = ?, EsAdministrador = ? WHERE IdEmpleado = ?',
                    [fullLogin, hashedPassword, isAdmin ? 1 : 0, employeeId]
                );
            }
        }

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
        if (foodieProjectsConnection) await foodieProjectsConnection.end();
    }
}

