import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = parseInt(searchParams.get('projectId') || '1');
        connection = await getProjectConnection(projectId);

        console.log('Ensuring columns for projectId:', projectId);
        
        // 1. Check columns
        const [columns]: any = await connection.query('SHOW COLUMNS FROM tblCompras');
        const columnNames = columns.map((c: any) => c.Field);
        console.log('Current columns:', columnNames);

        if (!columnNames.includes('ArchivoDocumento')) {
            await connection.query('ALTER TABLE tblCompras ADD COLUMN ArchivoDocumento LONGTEXT NULL');
            console.log('Added ArchivoDocumento');
        } else {
             // Ensure it is LONGTEXT or LONGBLOB
             await connection.query('ALTER TABLE tblCompras MODIFY COLUMN ArchivoDocumento LONGTEXT NULL');
             console.log('Verified ArchivoDocumento type');
        }

        if (!columnNames.includes('NombreArchivo')) {
            await connection.query('ALTER TABLE tblCompras ADD COLUMN NombreArchivo VARCHAR(255) NULL');
            console.log('Added NombreArchivo');
        }

        // Also check tblGastos for NombreArchivo (just in case)
        const [gastoColumns]: any = await connection.query('SHOW COLUMNS FROM tblGastos');
        const gastoColumnNames = gastoColumns.map((c: any) => c.Field);
        if (!gastoColumnNames.includes('NombreArchivo')) {
            await connection.query('ALTER TABLE tblGastos ADD COLUMN NombreArchivo VARCHAR(255) NULL');
            console.log('Added NombreArchivo to tblGastos');
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Database schema synchronized successfully',
            tblCompras: columnNames
        });
    } catch (error: any) {
        console.error('Migration error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
