import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const productIdStr = searchParams.get('productId');
        const documentIdStr = searchParams.get('documentId');

        if (!projectIdStr || !productIdStr || !documentIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const productId = parseInt(productIdStr);
        const documentId = parseInt(documentIdStr);

        connection = await getProjectConnection(projectId);

        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT ArchivoDocumento, NombreArchivo, RutaArchivo 
             FROM tblProductosDocumentos 
             WHERE IdProducto = ? AND IdProductoDocumento = ?`,
            [productId, documentId]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
        }

        const record = rows[0];
        const base64Data = record.ArchivoDocumento;
        const fileName = record.NombreArchivo || 'documento';

        if (!base64Data) {
            return NextResponse.json({ success: false, message: 'No file content associated with this record' }, { status: 404 });
        }

        // Convert Base64 string to Buffer
        const buffer = Buffer.from(base64Data.toString(), 'base64');

        // Determine content-type based on filename extension
        const extension = fileName.split('.').pop()?.toLowerCase();
        let contentType = 'application/octet-stream';

        const mimeTypes: { [key: string]: string } = {
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'txt': 'text/plain',
            'mp4': 'video/mp4',
            'mov': 'video/quicktime',
            'avi': 'video/x-msvideo'
        };

        if (extension && mimeTypes[extension]) {
            contentType = mimeTypes[extension];
        }

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });

    } catch (error) {
        console.error('Error downloading product document:', error);
        return NextResponse.json({ success: false, message: 'Error downloading document' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
