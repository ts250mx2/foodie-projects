import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const resolvedParams = await params;
        const projectId = parseInt(projectIdStr);
        const productId = parseInt(resolvedParams.id);
        connection = await getProjectConnection(projectId);

        // Ensure table exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tblProductosDocumentos (
                IdProductoDocumento INT AUTO_INCREMENT PRIMARY KEY,
                IdProducto INT NOT NULL,
                Descripcion TEXT,
                RutaArchivo VARCHAR(500),
                FechaAct DATETIME
            )
        `);

        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT IdProductoDocumento, IdProducto, Descripcion, RutaArchivo, FechaAct
             FROM tblProductosDocumentos
             WHERE IdProducto = ?
             ORDER BY FechaAct DESC`,
            [productId]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching product documents:', error);
        return NextResponse.json({ success: false, message: 'Error fetching product documents' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, descripcion, rutaArchivo } = body;

        if (!projectId || !descripcion) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const resolvedParams = await params;
        const productId = parseInt(resolvedParams.id);
        connection = await getProjectConnection(projectId);

        // Ensure table exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tblProductosDocumentos (
                IdProductoDocumento INT AUTO_INCREMENT PRIMARY KEY,
                IdProducto INT NOT NULL,
                Descripcion TEXT,
                RutaArchivo VARCHAR(500),
                FechaAct DATETIME
            )
        `);

        await connection.query<ResultSetHeader>(
            `INSERT INTO tblProductosDocumentos (IdProducto, Descripcion, RutaArchivo, FechaAct)
             VALUES (?, ?, ?, NOW())`,
            [productId, descripcion, rutaArchivo || null]
        );

        return NextResponse.json({
            success: true,
            message: 'Document saved successfully'
        });
    } catch (error) {
        console.error('Error saving product document:', error);
        return NextResponse.json({ success: false, message: 'Error saving product document' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, documentId, descripcion, rutaArchivo } = body;

        if (!projectId || !documentId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const resolvedParams = await params;
        const productId = parseInt(resolvedParams.id);
        connection = await getProjectConnection(projectId);

        await connection.query<ResultSetHeader>(
            `UPDATE tblProductosDocumentos 
             SET Descripcion = COALESCE(?, Descripcion),
                 RutaArchivo = COALESCE(?, RutaArchivo),
                 FechaAct = NOW()
             WHERE IdProductoDocumento = ? AND IdProducto = ?`,
            [descripcion, rutaArchivo, documentId, productId]
        );

        return NextResponse.json({
            success: true,
            message: 'Document updated successfully'
        });
    } catch (error) {
        console.error('Error updating product document:', error);
        return NextResponse.json({ success: false, message: 'Error updating product document' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const documentIdStr = searchParams.get('documentId');

        if (!projectIdStr || !documentIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const documentId = parseInt(documentIdStr);

        connection = await getProjectConnection(projectId);

        await connection.query<ResultSetHeader>(
            'DELETE FROM tblProductosDocumentos WHERE IdProductoDocumento = ?',
            [documentId]
        );

        return NextResponse.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error deleting document:', error);
        return NextResponse.json({ success: false, message: 'Error deleting document' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
