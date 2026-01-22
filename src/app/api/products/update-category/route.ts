import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, productId, categoryId } = body;

        if (!projectId || !productId || !categoryId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        await connection.query<ResultSetHeader>(
            'UPDATE tblProductos SET IdCategoriaRecetario = ?, FechaAct = NOW() WHERE IdProducto = ?',
            [categoryId, productId]
        );

        return NextResponse.json({ success: true, message: 'Product category updated successfully' });
    } catch (error) {
        console.error('Error updating product category:', error);
        return NextResponse.json({ success: false, message: 'Database error' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
