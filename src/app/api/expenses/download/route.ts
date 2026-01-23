import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const day = searchParams.get('day');
        const monthStr = searchParams.get('month'); // 0-11
        const year = searchParams.get('year');
        const conceptIdStr = searchParams.get('conceptId');

        if (!projectIdStr || !branchIdStr || !day || monthStr === null || !year || !conceptIdStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const month = parseInt(monthStr) + 1; // 1-12 for SQL
        const conceptId = parseInt(conceptIdStr);

        connection = await getProjectConnection(projectId);

        // Fetch file from database
        const [rows] = (await connection.query(
            `SELECT ArchivoDocumento, NombreArchivo FROM tblGastos 
             WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdSucursal = ? AND IdConceptoGasto = ?`,
            [day, month, year, branchId, conceptId]
        );

        if (rows.length === 0 || !rows[0].ArchivoDocumento) {
            return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
        }

        const { ArchivoDocumento, NombreArchivo } = rows[0];
        const fileBuffer = Buffer.from(ArchivoDocumento, 'base64');

        // Determine content type based on extension
        const extension = NombreArchivo.split('.').pop()?.toLowerCase();
        let contentType = 'application/octet-stream';

        switch (extension) {
            case 'pdf': contentType = 'application/pdf'; break;
            case 'jpg':
            case 'jpeg': contentType = 'image/jpeg'; break;
            case 'png': contentType = 'image/png'; break;
            case 'gif': contentType = 'image/gif'; break;
            case 'doc': contentType = 'application/msword'; break;
            case 'docx': contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; break;
            case 'xls': contentType = 'application/vnd.ms-excel'; break;
            case 'xlsx': contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; break;
        }

        // Return file with appropriate headers
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${NombreArchivo}"`,
            },
        });
    } catch (error) {
        console.error('Error downloading file:', error);
        return NextResponse.json({ success: false, message: 'Error downloading file' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

