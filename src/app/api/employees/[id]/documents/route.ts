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

        // List documents with document type name
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT ed.IdEmpleadoDocumento, ed.IdTipoDocumento, ed.Documento, ed.Comentarios, ed.RutaArchivo, ed.FechaAct,
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
        const { projectId, documentTypeId, originalFileName, comments, fileBase64 } = body;

        if (!projectId || !documentTypeId || !fileBase64) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const projectIdInt = parseInt(projectId);
        connection = await getProjectConnection(projectIdInt);

        // 1. Get Employee Name
        const [empRows] = await connection.query<RowDataPacket[]>(
            'SELECT Empleado FROM tblEmpleados WHERE IdEmpleado = ?',
            [id]
        );
        if (empRows.length === 0) {
            return NextResponse.json({ success: false, message: 'Employee not found' }, { status: 404 });
        }
        const rawEmpName = empRows[0].Empleado || 'Empleado';
        const employeeName = rawEmpName.replace(/[^a-z0-9]/gi, '_');

        // 2. Insert record to get ID
        const [result] = await connection.query<ResultSetHeader>(
            `INSERT INTO tblEmpleadosDocumentos (IdEmpleado, IdTipoDocumento, Comentarios, FechaAct) 
             VALUES (?, ?, ?, Now())`,
            [id, documentTypeId, comments || null]
        );
        const docId = result.insertId;

        // 3. Save to filesystem
        const extension = path.extname(originalFileName) || '.bin';
        const fileName = `${employeeName}_${docId}${extension}`;
        const relativePath = `/documentos/${fileName}`;
        const absolutePath = path.join(process.cwd(), 'public', 'documentos', fileName);

        const buffer = Buffer.from(fileBase64, 'base64');
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, buffer);

        // 4. Update DB with path
        await connection.query(
            'UPDATE tblEmpleadosDocumentos SET RutaArchivo = ? WHERE IdEmpleadoDocumento = ?',
            [relativePath, docId]
        );

        return NextResponse.json({ success: true, message: 'Document uploaded successfully', path: relativePath });
    } catch (error) {
        console.error('Error uploading document:', error);
        return NextResponse.json({ success: false, message: 'Error uploading document' }, { status: 500 });
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

        // 1. Get file path to delete from disk
        const [rows] = await connection.query<RowDataPacket[]>(
            'SELECT RutaArchivo FROM tblEmpleadosDocumentos WHERE IdEmpleadoDocumento = ? AND IdEmpleado = ?',
            [docId, id]
        );

        if (rows.length > 0 && rows[0].RutaArchivo) {
            const absolutePath = path.join(process.cwd(), 'public', rows[0].RutaArchivo);
            try {
                await fs.unlink(absolutePath);
            } catch (unlinkError) {
                console.error('Error deleting file from disk:', unlinkError);
            }
        }

        // 2. Delete record
        await connection.query<ResultSetHeader>(
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
