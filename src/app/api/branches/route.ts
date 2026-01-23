import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // Fetch active branches (Status = 0) with all fields
        const [rows] = await connection.query(
            `SELECT s.*, e.Empleado as GerenteNombre 
             FROM tblSucursales s
             LEFT JOIN tblEmpleados e ON s.IdEmpleadoGerente = e.IdEmpleado
             WHERE s.Status = 0 
             ORDER BY s.Sucursal ASC`
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching branches:', error);
        return NextResponse.json({ success: false, message: 'Error fetching branches' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branch, phone, email, address, managerId } = body;

        if (!projectId || !branch) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        const [result] = await connection.query(
            `INSERT INTO tblSucursales (Sucursal, Telefonos, CorreoElectronico, Calle, IdEmpleadoGerente, Status, FechaAct) 
             VALUES (?, ?, ?, ?, ?, 0, Now())`,
            [branch, phone || null, email || null, address || null, managerId || null]
        );

        return NextResponse.json({
            success: true,
            message: 'Branch created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating branch:', error);
        return NextResponse.json({ success: false, message: 'Error creating branch' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

