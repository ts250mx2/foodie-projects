import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // List documents including ArchivoDocumento (Base64) and NombreArchivo
        const [rows] = await connection.query<RowDataPacket[]>(
            'SELECT IdSucursalDocumento, Documento, Comentarios, ArchivoDocumento, NombreArchivo, FechaAct FROM tblSucursalesDocumentos WHERE IdSucursal = ? ORDER BY FechaAct DESC',
            [id]
        );

        // Convert Buffer to String if necessary (for BLOBs)
        const safeRows = rows.map(row => ({
            ...row,
            ArchivoDocumento: row.ArchivoDocumento ? row.ArchivoDocumento.toString() : null
        }));

        return NextResponse.json({ success: true, data: safeRows });
    } catch (error) {
        console.error('Error in branch documents API:', error);
        return NextResponse.json({ success: false, message: 'Error in branch documents API' }, { status: 500 });
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
        const { id } = await params;
        const body = await request.json();
        const { projectId, documentName, comments, fileBase64 } = body;

        if (!projectId || !documentName) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const projectIdInt = parseInt(projectId);
        connection = await getProjectConnection(projectIdInt);

        // Insert record (File is optional)
        const [result] = await connection.query<ResultSetHeader>(
            `INSERT INTO tblSucursalesDocumentos (IdSucursal, Documento, Comentarios, ArchivoDocumento, FechaAct) 
             VALUES (?, ?, ?, ?, Now())`,
            [id, documentName, comments || null, fileBase64 || null]
        );

        return NextResponse.json({ success: true, message: 'Document created successfully', id: result.insertId });
    } catch (error) {
        console.error('Error creating document:', error);
        return NextResponse.json({ success: false, message: 'Error creating document' }, { status: 500 });
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
        const { id } = await params; // IdSucursal
        const body = await request.json();
        const { projectId, documentId, documentName, comments, fileBase64, fileName } = body;

        if (!projectId || !documentId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const projectIdInt = parseInt(projectId);
        connection = await getProjectConnection(projectIdInt);

        // Construct update query dynamically
        let updateFields = [];
        let updateValues = [];

        if (documentName) {
            updateFields.push('Documento = ?');
            updateValues.push(documentName);
        }
        if (comments !== undefined) {
            updateFields.push('Comentarios = ?');
            updateValues.push(comments);
        }
        if (fileBase64 !== undefined) {
            updateFields.push('ArchivoDocumento = ?');
            updateValues.push(fileBase64);
        }
        if (fileName) {
            updateFields.push('NombreArchivo = ?');
            updateValues.push(fileName);
        }

        updateFields.push('FechaAct = Now()');

        if (updateFields.length === 0) {
            return NextResponse.json({ success: true, message: 'No changes to save' });
        }

        const query = `UPDATE tblSucursalesDocumentos SET ${updateFields.join(', ')} WHERE IdSucursalDocumento = ? AND IdSucursal = ?`;
        updateValues.push(documentId, id);

        await connection.query(query, updateValues);

        return NextResponse.json({ success: true, message: 'Document updated successfully' });
    } catch (error) {
        console.error('Error updating document:', error);
        return NextResponse.json({ success: false, message: 'Error updating document' }, { status: 500 });
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
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const docId = searchParams.get('docId');

        if (!projectIdStr || !docId) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        await connection.query<ResultSetHeader>(
            'DELETE FROM tblSucursalesDocumentos WHERE IdSucursalDocumento = ? AND IdSucursal = ?',
            [docId, id]
        );

        return NextResponse.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error deleting document:', error);
        return NextResponse.json({ success: false, message: 'Error deleting document' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
