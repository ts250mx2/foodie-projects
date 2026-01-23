import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const idProductoPadreStr = searchParams.get('idProductoPadre');
        const idProductoHijoStr = searchParams.get('idProductoHijo');

        if (!projectIdStr || !idProductoPadreStr || !idProductoHijoStr) {
            return NextResponse.json({ success: false, message: 'Project ID, IdProductoPadre, and IdProductoHijo are required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const idProductoPadre = parseInt(idProductoPadreStr);
        const idProductoHijo = parseInt(idProductoHijoStr);

        connection = await getProjectConnection(projectId);

        const [result] = (await connection.query(
            'DELETE FROM tblProductosKits WHERE IdProductoPadre = ? AND IdProductoHijo = ?',
            [idProductoPadre, idProductoHijo]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ success: false, message: 'Product kit item not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Product kit item deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting product kit item:', error);
        return NextResponse.json({ success: false, message: 'Error deleting product kit item' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
