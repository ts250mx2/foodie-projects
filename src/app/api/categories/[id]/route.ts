import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, category, esRecetario } = body;

        if (!projectId || !category) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        const [result] = await connection.query(
            'UPDATE tblCategorias SET Categoria = ?, EsRecetario = ?, FechaAct = Now() WHERE IdCategoria = ?',
            [category, esRecetario || 0, id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ success: false, message: 'Category not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Category updated successfully'
        });
    } catch (error) {
        console.error('Error updating category:', error);
        return NextResponse.json({ success: false, message: 'Error updating category' }, { status: 500 });
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

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // Soft delete: Set Status = 1
        const [result] = await connection.query(
            'UPDATE tblCategorias SET Status = 1, FechaAct = Now() WHERE IdCategoria = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ success: false, message: 'Category not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting category:', error);
        return NextResponse.json({ success: false, message: 'Error deleting category' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
