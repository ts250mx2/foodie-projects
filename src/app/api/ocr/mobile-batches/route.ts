import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

/** Ensure IdGasto / IdCompra columns exist on tblDetalleDocumentosOCR */
async function ensureDetailColumns(connection: any) {
    try {
        await connection.query(`
            ALTER TABLE tblDetalleDocumentosOCR
            ADD COLUMN IF NOT EXISTS IdGasto INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS IdCompra INT DEFAULT 0
        `);
    } catch { /* already exist */ }
}

/** Verify that the uuid matches the project */
async function validateUuid(projectId: number, uuid: string): Promise<boolean> {
    try {
        const [rows] = await pool.query(
            'SELECT IdProyecto FROM tblProyectos WHERE IdProyecto = ? AND UuidOCR = ?',
            [projectId, uuid]
        ) as [RowDataPacket[], any];
        return rows.length > 0;
    } catch {
        return false;
    }
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    let connection: any;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const date = searchParams.get('date');
        const detailIdStr = searchParams.get('detailId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'projectId required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);
        await ensureDetailColumns(connection);

        // Single photo (base64 for display)
        if (detailIdStr) {
            const [rows] = await connection.query(
                `SELECT IdDetalleDocumentoOCR, IdDocumentoOCR, Orden, DocumentoOCR, IdGasto, IdCompra
                 FROM tblDetalleDocumentosOCR WHERE IdDetalleDocumentoOCR = ?`,
                [parseInt(detailIdStr)]
            ) as [RowDataPacket[], any];
            return NextResponse.json({ success: true, data: rows[0] || null });
        }

        // Single batch detail (metadata only, no base64)
        if (date) {
            const [headerRows] = await connection.query(
                `SELECT IdDocumentoOCR, DocumentoOCR, FechaCompraGasto 
                 FROM tblDocumentosOCR 
                 WHERE DocumentoOCR LIKE 'Documentos del dia%' 
                   AND DATE(FechaCompraGasto) = ?`,
                [date]
            ) as [RowDataPacket[], any];

            if (headerRows.length === 0) {
                return NextResponse.json({ success: true, data: null });
            }

            const docId = headerRows[0].IdDocumentoOCR;
            const [details] = await connection.query(
                `SELECT IdDetalleDocumentoOCR, Orden, IdGasto, IdCompra
                 FROM tblDetalleDocumentosOCR 
                 WHERE IdDocumentoOCR = ? ORDER BY Orden ASC`,
                [docId]
            ) as [RowDataPacket[], any];

            return NextResponse.json({
                success: true,
                data: { ...headerRows[0], details }
            });
        }

        // Batch list (cards)
        const [batches] = await connection.query(`
            SELECT 
                h.IdDocumentoOCR,
                h.DocumentoOCR,
                h.FechaCompraGasto,
                COUNT(d.IdDetalleDocumentoOCR) AS TotalFotos,
                SUM(CASE WHEN d.IdGasto = 0 AND d.IdCompra = 0 THEN 1 ELSE 0 END) AS FotosPendientes,
                (SELECT SUBSTRING(d2.DocumentoOCR, 1, 200)
                 FROM tblDetalleDocumentosOCR d2
                 WHERE d2.IdDocumentoOCR = h.IdDocumentoOCR
                 ORDER BY d2.Orden ASC LIMIT 1) AS FirstThumb
            FROM tblDocumentosOCR h
            LEFT JOIN tblDetalleDocumentosOCR d ON d.IdDocumentoOCR = h.IdDocumentoOCR
            WHERE h.DocumentoOCR LIKE 'Documentos del dia%'
            GROUP BY h.IdDocumentoOCR
            ORDER BY h.FechaCompraGasto DESC
        `) as [RowDataPacket[], any];

        return NextResponse.json({ success: true, data: batches });
    } catch (error: any) {
        console.error('Error fetching mobile batches:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}


// ─── POST ─────────────────────────────────────────────────────────────────────
// Upload a single photo from the phone → upsert day header → insert detail
// Body: { projectId, uuid, date: 'YYYY-MM-DD', imageBase64 }
export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, uuid, date, imageBase64 } = body;

        if (!projectId || !uuid || !date || !imageBase64) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        // Validate UUID ownership
        const valid = await validateUuid(parseInt(projectId), uuid);
        if (!valid) {
            return NextResponse.json({ success: false, message: 'Invalid project or uuid' }, { status: 403 });
        }

        connection = await getProjectConnection(parseInt(projectId));
        await ensureDetailColumns(connection);
        await connection.beginTransaction();

        try {
            const dayLabel = `Documentos del dia ${date}`;

            // Upsert header for this day
            const [existing] = await connection.query(
                `SELECT IdDocumentoOCR FROM tblDocumentosOCR 
                 WHERE DocumentoOCR = ? AND DATE(FechaCompraGasto) = ?`,
                [dayLabel, date]
            ) as [RowDataPacket[], any];

            let docId: number;
            if (existing.length > 0) {
                docId = existing[0].IdDocumentoOCR;
            } else {
                const [headerResult] = await connection.query(
                    `INSERT INTO tblDocumentosOCR (DocumentoOCR, Status, FechaAct, FechaCompraGasto) 
                     VALUES (?, 0, NOW(), ?)`,
                    [dayLabel, `${date} 00:00:00`]
                ) as [ResultSetHeader, any];
                docId = headerResult.insertId;
            }

            // Get next order
            const [orderRows] = await connection.query(
                'SELECT COALESCE(MAX(Orden), 0) + 1 AS NextOrden FROM tblDetalleDocumentosOCR WHERE IdDocumentoOCR = ?',
                [docId]
            ) as [RowDataPacket[], any];
            const nextOrden = orderRows[0].NextOrden;

            // Insert detail
            const [detailResult] = await connection.query(
                `INSERT INTO tblDetalleDocumentosOCR (IdDocumentoOCR, Orden, DocumentoOCR, FechaAct, IdGasto, IdCompra) 
                 VALUES (?, ?, ?, NOW(), 0, 0)`,
                [docId, nextOrden, imageBase64]
            ) as [ResultSetHeader, any];

            await connection.commit();

            return NextResponse.json({
                success: true,
                idDocumentoOCR: docId,
                idDetalleDocumentoOCR: detailResult.insertId
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        }
    } catch (error: any) {
        console.error('Error uploading mobile batch photo:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
// Update IdGasto or IdCompra on a detail row after processing
// Body: { projectId, idDetalleDocumentoOCR, idGasto?, idCompra? }
export async function PATCH(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, idDetalleDocumentoOCR, idGasto, idCompra } = body;

        if (!projectId || !idDetalleDocumentoOCR) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));
        await ensureDetailColumns(connection);

        const updates: string[] = [];
        const params: any[] = [];

        if (idGasto !== undefined) {
            updates.push('IdGasto = ?');
            params.push(idGasto);
        }
        if (idCompra !== undefined) {
            updates.push('IdCompra = ?');
            params.push(idCompra);
        }

        if (updates.length === 0) {
            return NextResponse.json({ success: false, message: 'No fields to update' }, { status: 400 });
        }

        params.push(idDetalleDocumentoOCR);
        await connection.query(
            `UPDATE tblDetalleDocumentosOCR SET ${updates.join(', ')}, FechaAct = NOW() WHERE IdDetalleDocumentoOCR = ?`,
            params
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating batch detail:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
