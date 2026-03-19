import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { Connection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export async function GET(request: NextRequest) {
    let connection: Connection | null = null;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const docIdStr = searchParams.get('docId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // If docId is provided, fetch single document with details
        if (docIdStr) {
            const docId = parseInt(docIdStr);
            
            // Get Header
            const [headerRows] = await connection.query<RowDataPacket[]>(
                `SELECT IdDocumentoOCR, DocumentoOCR, Status, FechaCompraGasto 
                 FROM tblDocumentosOCR WHERE IdDocumentoOCR = ?`,
                [docId]
            );

            if (headerRows.length === 0) {
                return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
            }

            // Get Details
            const [detailRows] = await connection.query<RowDataPacket[]>(
                `SELECT IdDetalleDocumentoOCR, DocumentoOCR, Orden 
                 FROM tblDetalleDocumentosOCR WHERE IdDocumentoOCR = ? ORDER BY Orden`,
                [docId]
            );

            return NextResponse.json({ 
                success: true, 
                data: {
                    ...headerRows[0],
                    details: detailRows
                }
            });
        }

        // Default list fetch
        let query = `
            SELECT h.*, 
            (SELECT DocumentoOCR FROM tblDetalleDocumentosOCR d WHERE d.IdDocumentoOCR = h.IdDocumentoOCR ORDER BY Orden LIMIT 1) as FirstImage,
            (SELECT COUNT(*) FROM tblDetalleDocumentosOCR d WHERE d.IdDocumentoOCR = h.IdDocumentoOCR) as TotalCount
            FROM tblDocumentosOCR h`;
        const params: any[] = [];
        if (startDate && endDate) {
            query += ` WHERE h.FechaCompraGasto BETWEEN ? AND ?`;
            params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        }

        query += ` ORDER BY h.IdDocumentoOCR DESC`;

        const [rows] = await connection.query<RowDataPacket[]>(query, params);

        return NextResponse.json({ success: true, data: rows });
    } catch (error: any) {
        console.error('Error fetching OCR documents:', error);
        return NextResponse.json({ success: false, message: 'Error fetching documents: ' + error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection: Connection | null = null;
    try {
        const body = await request.json();
        const { projectId, description, documents } = body;

        if (!projectId || !description || !Array.isArray(documents)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const projectIdInt = parseInt(projectId);
        connection = await getProjectConnection(projectIdInt);

        // Start transaction
        await connection.beginTransaction();

        try {
            // 1. Insert into tblDocumentosOCR
            const [headerResult] = await connection.query<ResultSetHeader>(
                `INSERT INTO tblDocumentosOCR (DocumentoOCR, Status, FechaAct, FechaCompraGasto) 
                 VALUES (?, 0, NOW(), NOW())`,
                [description]
            );

            const headerId = headerResult.insertId;

            // 2. Insert into tblDetalleDocumentosOCR
            for (let i = 0; i < documents.length; i++) {
                await connection.query(
                    `INSERT INTO tblDetalleDocumentosOCR (IdDocumentoOCR, Orden, DocumentoOCR, FechaAct) 
                     VALUES (?, ?, ?, NOW())`,
                    [headerId, i + 1, documents[i]]
                );
            }

            await connection.commit();

            return NextResponse.json({
                success: true,
                message: 'Documents added successfully',
                id: headerId
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error: any) {
        console.error('Error adding OCR documents:', error);
        return NextResponse.json({ success: false, message: 'Error adding documents: ' + error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection: Connection | null = null;
    try {
        const { projectId, docId, description, documents } = await request.json();

        if (!projectId || !docId || !description || !Array.isArray(documents)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const projectIdInt = parseInt(projectId);
        const docIdInt = parseInt(docId);
        connection = await getProjectConnection(projectIdInt);
        
        // Start transaction
        await connection.beginTransaction();

        try {
            // 1. Update Header
            await connection.query(
                `UPDATE tblDocumentosOCR SET DocumentoOCR = ?, FechaAct = NOW() WHERE IdDocumentoOCR = ?`,
                [description, docIdInt]
            );

            // 2. Clear old details
            await connection.query(
                `DELETE FROM tblDetalleDocumentosOCR WHERE IdDocumentoOCR = ?`,
                [docIdInt]
            );

            // 3. Insert new details
            for (let i = 0; i < documents.length; i++) {
                await connection.query(
                    `INSERT INTO tblDetalleDocumentosOCR (IdDocumentoOCR, Orden, DocumentoOCR, FechaAct) 
                     VALUES (?, ?, ?, NOW())`,
                    [docIdInt, i + 1, documents[i]]
                );
            }

            await connection.commit();
            return NextResponse.json({ success: true, message: 'Documents updated successfully' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error: any) {
        console.error('Error updating OCR documents:', error);
        return NextResponse.json({ success: false, message: 'Error updating documents: ' + error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection: Connection | null = null;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const docIdStr = searchParams.get('docId');

        if (!projectIdStr || !docIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID and Document ID are required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const docId = parseInt(docIdStr);
        connection = await getProjectConnection(projectId);

        // Start transaction
        await connection.beginTransaction();

        try {
            // Delete Details first
            await connection.query(
                `DELETE FROM tblDetalleDocumentosOCR WHERE IdDocumentoOCR = ?`,
                [docId]
            );

            // Delete Header
            await connection.query(
                `DELETE FROM tblDocumentosOCR WHERE IdDocumentoOCR = ?`,
                [docId]
            );

            await connection.commit();
            return NextResponse.json({ success: true, message: 'Document deleted successfully' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error: any) {
        console.error('Error deleting OCR document:', error);
        return NextResponse.json({ success: false, message: 'Error deleting document: ' + error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
