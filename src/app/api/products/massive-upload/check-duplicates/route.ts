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
        connection = await getProjectConnection(projectId);

        // Fetch products where Status = 0 (Active)
        const [products] = await connection.query(
            'SELECT Codigo, Producto FROM tblProductos WHERE Status = 0'
        ) as [RowDataPacket[], any];

        // Fetch categories where Status = 0
        const [categories] = await connection.query(
            'SELECT Categoria FROM tblCategorias WHERE Status = 0'
        ) as [RowDataPacket[], any];

        // Fetch recipe modules where Status = 0
        const [recipeModules] = await connection.query(
            'SELECT CategoriaRecetario FROM tblCategoriasRecetario'
        ) as [RowDataPacket[], any];

        return NextResponse.json({
            success: true,
            products: products.map(p => ({
                code: p.Codigo?.toString(),
                name: p.Producto
            })),
            categories: categories.map(c => c.Categoria),
            recipeModules: recipeModules.map(r => r.CategoriaRecetario)
        });

    } catch (error) {
        console.error('Error fetching existing products for duplicate check:', error);
        return NextResponse.json({ success: false, message: 'Error checking duplicates' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
