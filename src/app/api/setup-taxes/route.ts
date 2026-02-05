import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId } = body;

        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Create tblImpuestos if it doesn't exist
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tblImpuestos (
                IdImpuesto INT AUTO_INCREMENT PRIMARY KEY,
                Descripcion VARCHAR(100) NOT NULL,
                Impuesto DECIMAL(10, 2) NOT NULL,
                Status INT DEFAULT 0,
                FechaAct DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        return NextResponse.json({
            success: true,
            message: 'tblImpuestos created or already exists'
        });
    } catch (error) {
        console.error('Error setting up taxes table:', error);
        return NextResponse.json({ success: false, message: 'Error setting up taxes table' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
