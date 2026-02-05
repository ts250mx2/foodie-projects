import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

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

        const [rows] = await connection.query('SELECT * FROM tblImpuestos WHERE Status = 0 ORDER BY Descripcion ASC');

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching taxes:', error);
        return NextResponse.json({ success: false, message: 'Error fetching taxes' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, description, percentage } = body;

        if (!projectId || !description || percentage === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        const [result] = await connection.query(
            'INSERT INTO tblImpuestos (Descripcion, Impuesto, Status, FechaAct) VALUES (?, ?, 0, NOW())',
            [description, percentage]
        );

        return NextResponse.json({
            success: true,
            message: 'Tax created successfully',
            id: (result as any).insertId
        });
    } catch (error) {
        console.error('Error creating tax:', error);
        return NextResponse.json({ success: false, message: 'Error creating tax' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, id, description, percentage } = body;

        if (!projectId || !id || !description || percentage === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        await connection.query(
            'UPDATE tblImpuestos SET Descripcion = ?, Impuesto = ?, FechaAct = NOW() WHERE IdImpuesto = ?',
            [description, percentage, id]
        );

        return NextResponse.json({
            success: true,
            message: 'Tax updated successfully'
        });
    } catch (error) {
        console.error('Error updating tax:', error);
        return NextResponse.json({ success: false, message: 'Error updating tax' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const idStr = searchParams.get('id');

        if (!projectIdStr || !idStr) {
            return NextResponse.json({ success: false, message: 'Project ID and Tax ID are required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const id = parseInt(idStr);

        connection = await getProjectConnection(projectId);

        // Soft delete: Status = 1
        await connection.query(
            'UPDATE tblImpuestos SET Status = 1, FechaAct = NOW() WHERE IdImpuesto = ?',
            [id]
        );

        return NextResponse.json({
            success: true,
            message: 'Tax deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting tax:', error);
        return NextResponse.json({ success: false, message: 'Error deleting tax' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
