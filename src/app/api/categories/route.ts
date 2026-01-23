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

        const [rows] = await connection.query('SELECT * FROM tblCategorias WHERE Status = 0 ORDER BY Categoria ASC');

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching categories:', error);
        return NextResponse.json({ success: false, message: 'Error fetching categories' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, category, esRecetario } = body;

        if (!projectId || !category) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Status = 0 (Active), FechaAct = Now(), EsRecetario defaults to 0 if not provided
        const [result] = await connection.query(
            'INSERT INTO tblCategorias (Categoria, EsRecetario, Status, FechaAct) VALUES (?, ?, 0, Now())',
            [category, esRecetario || 0]
        );

        return NextResponse.json({
            success: true,
            message: 'Category created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating category:', error);
        return NextResponse.json({ success: false, message: 'Error creating category' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

