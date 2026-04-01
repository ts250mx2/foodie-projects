import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const type = searchParams.get('type') || '2'; // Default to sub-recipes
        connection = await getProjectConnection(projectId);

        // Fetch products based on type: 2 for sub-recipes, 1 for dishes (platillos)
        const [rows] = await connection.query(
            `SELECT p.*, cat.Categoria, pres.Presentacion 
             FROM tblProductos p
             LEFT JOIN tblCategorias cat ON p.IdCategoria = cat.IdCategoria
             LEFT JOIN tblPresentaciones pres ON p.IdPresentacion = pres.IdPresentacion
             WHERE p.IdTipoProducto = ? AND p.Status = 0 
             ORDER BY p.Producto ASC`,
            [parseInt(type)]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching sub-recipes:', error);
        return NextResponse.json({ success: false, message: 'Error fetching sub-recipes' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
