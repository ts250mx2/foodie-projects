import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = parseInt(searchParams.get('projectId') || '1');
        connection = await getProjectConnection(projectId);

        // Check and Add columns
        const [columns]: any = await connection.query('SHOW COLUMNS FROM tblCompras');
        const columnNames = columns.map((c: any) => c.Field);

        if (!columnNames.includes('ArchivoDocumento')) {
            await connection.query('ALTER TABLE tblCompras ADD COLUMN ArchivoDocumento LONGTEXT NULL');
            console.log('Added ArchivoDocumento');
        }
        if (!columnNames.includes('NombreArchivo')) {
            await connection.query('ALTER TABLE tblCompras ADD COLUMN NombreArchivo VARCHAR(255) NULL');
            console.log('Added NombreArchivo');
        }

        return NextResponse.json({ success: true, columns: columnNames });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
