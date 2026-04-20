import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

/**
 * Ensures the tblOCRQRTransfer table exists in the main database.
 */
async function ensureTableExists() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tblOCRQRTransfer (
            Id INT AUTO_INCREMENT PRIMARY KEY,
            SessionId VARCHAR(100) NOT NULL UNIQUE,
            ImageBase64 MEDIUMTEXT NULL,
            Status INT DEFAULT 0, -- 0: Pending, 1: Uploaded, 2: Consumed
            FechaAlt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

export async function GET(request: NextRequest) {
    try {
        await ensureTableExists();
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) {
            return NextResponse.json({ success: false, message: 'Missing sessionId' }, { status: 400 });
        }

        // Check for uploaded image
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT ImageBase64 FROM tblOCRQRTransfer WHERE SessionId = ? AND Status = 1',
            [sessionId]
        );

        if (rows.length > 0) {
            const image = rows[0].ImageBase64;
            
            // Mark as consumed
            await pool.query(
                'UPDATE tblOCRQRTransfer SET Status = 2 WHERE SessionId = ?',
                [sessionId]
            );

            return NextResponse.json({ success: true, image });
        }

        return NextResponse.json({ success: true, pending: true });
    } catch (error: any) {
        console.error('QR Sync GET Error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await ensureTableExists();
        const body = await request.json();
        const { sessionId, image, action } = body;

        if (!sessionId) {
            return NextResponse.json({ success: false, message: 'Missing sessionId' }, { status: 400 });
        }

        if (action === 'register') {
            // Register a new session
            await pool.query(
                'INSERT INTO tblOCRQRTransfer (SessionId, Status) VALUES (?, 0) ON DUPLICATE KEY UPDATE Status = 0, ImageBase64 = NULL',
                [sessionId]
            );
            return NextResponse.json({ success: true });
        }

        if (!image) {
            return NextResponse.json({ success: false, message: 'Missing image' }, { status: 400 });
        }

        // Update with image
        await pool.query(
            'UPDATE tblOCRQRTransfer SET ImageBase64 = ?, Status = 1 WHERE SessionId = ?',
            [image, sessionId]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('QR Sync POST Error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
