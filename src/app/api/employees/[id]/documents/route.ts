import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import path from 'path';
import fs from 'fs/promises';

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

        // List documents with document type name, including Base64 data and filename
        const [rows] = (await connection.query(
            `SELECT ed.IdEmpleadoDocumento, ed.IdTipoDocumento, ed.Documento, ed.Comentarios, 
                    ed.RutaArchivo, ed.ArchivoDocumento, ed.NombreArchivo, ed.FechaAct,
                    td.TipoDocumento
             FROM tblEmpleadosDocumentos ed
             LEFT JOIN tblTiposDocumentos td ON ed.IdTipoDocumento = td.IdTipoDocumento
             WHERE ed.IdEmpleado = ? 
             ORDER BY ed.FechaAct DESC`,
            [id]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error in employee documents API:', error);
        return NextResponse.json({ success: false, message: 'Error in employee documents API' }, { status: 500 });
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
        const { projectId, documentTypeId, comments } = body;

        if (!projectId || !documentTypeId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const projectIdInt = parseInt(projectId);
        connection = await getProjectConnection(projectIdInt);

        // Insert metadata only (no file initially)
        const [result] = (await connection.query(
            `INSERT INTO tblEmpleadosDocumentos (IdEmpleado, IdTipoDocumento, Comentarios, FechaAct) 
             VALUES (?, ?, ?, Now())`,
            [id, documentTypeId, comments || null]
        );

        return NextResponse.json({ success: true, message: 'Document metadata created successfully', id: result.insertId });
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
        const { id } = await params;
        const body = await request.json();
        const { projectId, documentId, fileBase64, originalFileName, comments } = body;

        // documentId is required. 
        // We can update file info (fileBase64 + originalFileName) AND/OR comments.
        if (!projectId || !documentId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const projectIdInt = parseInt(projectId);
        connection = await getProjectConnection(projectIdInt);

        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];

        if (fileBase64 !== undefined) {
            // Store Base64 directly
            updates.push('ArchivoDocumento = ?');
            values.push(fileBase64); // Can be null if clearing? Usually we just overwrite
        }
        if (originalFileName !== undefined) {
            updates.push('NombreArchivo = ?');
            values.push(originalFileName);
        }
        if (comments !== undefined) {
            updates.push('Comentarios = ?');
            values.push(comments);
        }

        // Always update FechaAct
        updates.push('FechaAct = Now()');

        if (updates.length === 0) {
            return NextResponse.json({ success: true, message: 'No changes to update' });
        }

        const query = `UPDATE tblEmpleadosDocumentos SET ${updates.join(', ')} WHERE IdEmpleadoDocumento = ? AND IdEmpleado = ?`;
        values.push(documentId, id);

        await connection.query(query, values);

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

        // Optional: Check if there's a legacy file on disk to delete (RutaArchivo)
        // For now, we mainly delete the DB record. The previous file deletion logic can be kept if desired, 
        // but if we are moving to Base64, we might just leave legacy files or clean them up.
        // Let's check for legacy RutaArchivo just in case to keep system clean.
        const [rows] = (await connection.query(
            'SELECT RutaArchivo FROM tblEmpleadosDocumentos WHERE IdEmpleadoDocumento = ? AND IdEmpleado = ?',
            [docId, id]
        );

        if (rows.length > 0 && rows[0].RutaArchivo) {
            // It's a legacy file path (starts with /documentos/)
            if (!rows[0].RutaArchivo.startsWith('data:')) {
                const absolutePath = path.join(process.cwd(), 'public', rows[0].RutaArchivo);
                try {
                    await fs.unlink(absolutePath).catch(() => { });
                } catch (e) { }
            }
        }

        // Delete record
        await connection.query(
            'DELETE FROM tblEmpleadosDocumentos WHERE IdEmpleadoDocumento = ? AND IdEmpleado = ?',
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
