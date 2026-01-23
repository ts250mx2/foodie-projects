import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

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
            SELECT e.*, p.Puesto, s.Sucursal
            FROM tblEmpleados e 
            LEFT JOIN tblPuestos p ON e.IdPuesto = p.IdPuesto 
            LEFT JOIN tblSucursales s ON e.IdSucursal = s.IdSucursal
            WHERE e.Status = 0 
        `;
        const queryParams: any[] = [];

        if (branchIdStr) {
            query += ` AND e.IdSucursal = ? `;
            queryParams.push(parseInt(branchIdStr));
        }

        query += ` ORDER BY e.Empleado ASC `;

        // Join with tblPuestos and tblSucursales to get position and branch names
        const [rows] = (await connection.query(query, queryParams);

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
        const { projectId, name, positionId, branchId, phone, email, address } = body;

        if (!projectId || !name) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Status = 0 (Active), FechaAct = Now()
        const [result] = (await connection.query(
            `INSERT INTO tblEmpleados (Empleado, IdPuesto, IdSucursal, Telefonos, CorreoElectronico, Calle, Status, FechaAct) 
             VALUES (?, ?, ?, ?, ?, ?, 0, Now())`,
            [name, positionId || null, branchId || null, phone || null, email || null, address || null]
        );

        return NextResponse.json({
            success: true,
            message: 'Employee created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating employee:', error);
        return NextResponse.json({ success: false, message: 'Error creating employee' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

