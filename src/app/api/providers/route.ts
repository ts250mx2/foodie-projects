import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

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

        const [rows] = await connection.query(
            'SELECT IdProveedor, Proveedor, Status FROM tblProveedores WHERE Status = 0 ORDER BY Proveedor ASC'
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching providers:', error);
        return NextResponse.json({ success: false, message: 'Error fetching providers' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

