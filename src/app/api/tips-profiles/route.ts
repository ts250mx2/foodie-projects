import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        const [rows] = await connection.query(
            'SELECT * FROM tblPerfilesPropinas WHERE Status < 2 ORDER BY PerfilPropina ASC'
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error in tips-profiles API:', error);
        return NextResponse.json({ success: false, message: 'Error in tips-profiles API' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, profileName } = body;

        if (!projectId || !profileName) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        await connection.query(
            'INSERT INTO tblPerfilesPropinas (PerfilPropina, EsActivo, Status, FechaAct) VALUES (?, ?, 0, Now())',
            [profileName, body.esActivo !== undefined ? body.esActivo : 1]
        );

        return NextResponse.json({ success: true, message: 'Profile created successfully' });
    } catch (error) {
        console.error('Error creating profile:', error);
        return NextResponse.json({ success: false, message: 'Error creating profile' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

