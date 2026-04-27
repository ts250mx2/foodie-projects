import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        if (!projectIdStr) return NextResponse.json({ success: false, message: 'Missing projectId' }, { status: 400 });

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // Add columns if they don't exist
        await connection.query(`
            ALTER TABLE tblCompras 
            ADD COLUMN IF NOT EXISTS ArchivoDocumento LONGTEXT NULL,
            ADD COLUMN IF NOT EXISTS NombreArchivo VARCHAR(255) NULL
        `);

        return NextResponse.json({ success: true, message: 'Columns ensured' });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
