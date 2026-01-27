import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const searchParams = request.nextUrl.searchParams;
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        const [rows] = await connection.query(
            `SELECT IdSeccionMenu, SeccionMenu, Status 
             FROM tblSeccionesMenu 
             WHERE Status = 0
             ORDER BY SeccionMenu ASC`
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching menu sections:', error);
        return NextResponse.json({ success: false, message: 'Database error' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, seccionMenu } = body;

        if (!projectId || !seccionMenu) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        const [result] = await (connection as any).query(
            'INSERT INTO tblSeccionesMenu (SeccionMenu, FechaAct, Status) VALUES (?, NOW(), 0)',
            [seccionMenu]
        );

        return NextResponse.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Error creating menu section:', error);
        return NextResponse.json({ success: false, message: 'Database error' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { id, seccionMenu, status, projectId } = body;

        if (!id || !projectId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        if (status !== undefined) {
            // Probably a soft delete or restore (user specified Status=2 for deleted)
            await connection.query(
                'UPDATE tblSeccionesMenu SET Status = ?, FechaAct = NOW() WHERE IdSeccionMenu = ?',
                [status, id]
            );
        } else if (seccionMenu) {
            // Update name
            await connection.query(
                'UPDATE tblSeccionesMenu SET SeccionMenu = ?, FechaAct = NOW() WHERE IdSeccionMenu = ?',
                [seccionMenu, id]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating menu section:', error);
        return NextResponse.json({ success: false, message: 'Database error' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
