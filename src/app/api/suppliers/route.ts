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

        const [rows] = await connection.query<RowDataPacket[]>('SELECT * FROM tblProveedores WHERE Status = 0 ORDER BY Proveedor ASC');

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        return NextResponse.json({ success: false, message: 'Error fetching suppliers' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, proveedor, rfc, telefonos, correoElectronico, calle, contacto } = body;

        if (!projectId || !proveedor) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Status = 0 (Active), FechaAct = Now()
        const [result] = await connection.query<ResultSetHeader>(
            'INSERT INTO tblProveedores (Proveedor, RFC, Telefonos, CorreoElectronico, Calle, Contacto, Status, FechaAct) VALUES (?, ?, ?, ?, ?, ?, 0, Now())',
            [proveedor, rfc || '', telefonos || '', correoElectronico || '', calle || '', contacto || '']
        );

        return NextResponse.json({
            success: true,
            message: 'Supplier created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating supplier:', error);
        return NextResponse.json({ success: false, message: 'Error creating supplier' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
