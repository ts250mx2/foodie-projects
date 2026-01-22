import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

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

        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT IdCategoriaRecetario, CategoriaRecetario, Status 
             FROM tblCategoriasRecetario 
             WHERE Status = 1
             ORDER BY CategoriaRecetario ASC`
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching recipe book categories:', error);
        return NextResponse.json({ success: false, message: 'Database error' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, category } = body;

        if (!projectId || !category) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // IdProyecto column is likely NOT needed in the table itself if separate DBs are used per project, 
        // OR if it IS needed, we should still insert it. 
        // Logic in categories/route.ts INSERTs into tblCategorias WITHOUT IdProyecto in the query, 
        // implying the DB context provides isolation or the table doesn't have it.
        // However, the USER previously asked to use `tblCategoriasRecetario` and implied structure. 
        // The previous GET had `WHERE IdProyecto = ?`.
        // If we use dynamic DB, usually we don't need `IdProyecto` clause if the DB is isolated.
        // BUT, looking at `categories/route.ts` GET, it DOES NOT use `WHERE IdProyecto`.
        // So safe assumption: with getProjectConnection, we are in the project's DB.
        // Let's check if I should insert IdProyecto or not.
        // In the previous Code `categories/route.ts` POST: `INSERT INTO tblCategorias (Categoria, ...)` -> NO IdProyecto.
        // So I will REMOVE IdProyecto from the INSERT and SELECT queries here as well, matching the pattern.

        const [result] = await connection.query<ResultSetHeader>(
            'INSERT INTO tblCategoriasRecetario (CategoriaRecetario, FechaAct, Status) VALUES (?, NOW(), 1)',
            [category]
        );

        return NextResponse.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Error creating recipe book category:', error);
        return NextResponse.json({ success: false, message: 'Database error' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { id, category, projectId } = body; // Added projectId to body in PUT

        if (!id || !category || !projectId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        await connection.query(
            'UPDATE tblCategoriasRecetario SET CategoriaRecetario = ?, FechaAct = NOW() WHERE IdCategoriaRecetario = ?',
            [category, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating recipe book category:', error);
        return NextResponse.json({ success: false, message: 'Database error' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
