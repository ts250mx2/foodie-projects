import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

// Ensure UuidOCR column exists in tblProyectos
async function ensureUuidColumn() {
    try {
        await pool.query(`
            ALTER TABLE tblProyectos 
            ADD COLUMN IF NOT EXISTS UuidOCR VARCHAR(36) NULL
        `);
    } catch { /* column may already exist */ }
}

export async function GET(request: NextRequest) {
    try {
        await ensureUuidColumn();
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'projectId required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);

        // Get existing UUID
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT UuidOCR FROM tblProyectos WHERE IdProyecto = ?',
            [projectId]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        let uuid = rows[0].UuidOCR;

        // Generate and save if missing
        if (!uuid) {
            uuid = uuidv4();
            await pool.query(
                'UPDATE tblProyectos SET UuidOCR = ? WHERE IdProyecto = ?',
                [uuid, projectId]
            );
        }

        return NextResponse.json({ success: true, uuid });
    } catch (error: any) {
        console.error('Error fetching project UUID:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
