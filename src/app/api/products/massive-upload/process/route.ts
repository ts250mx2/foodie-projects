import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, products } = body;

        if (!projectId || !products || !Array.isArray(products)) {
            return NextResponse.json({ success: false, message: 'Invalid data' }, { status: 400 });
        }

        if (products.length === 0) {
            return NextResponse.json({ success: true, message: 'No products to process', count: 0 });
        }

        connection = await getProjectConnection(projectId);

        // Fetch all categories for mapping
        const [categories] = await connection.query(
            'SELECT IdCategoria, Categoria FROM tblCategorias'
        ) as [RowDataPacket[], any];

        // Fetch all recipe modules for mapping
        const [recipeModules] = await connection.query(
            'SELECT IdCategoriaRecetario, CategoriaRecetario FROM tblCategoriasRecetario'
        ) as [RowDataPacket[], any];

        // Create mapping objects
        const categoryMap = new Map<string, number>();
        categories.forEach(c => {
            if (c.Categoria) categoryMap.set(c.Categoria.toLowerCase().trim(), c.IdCategoria);
        });

        const recipeModuleMap = new Map<string, number>();
        recipeModules.forEach(r => {
            if (r.CategoriaRecetario) recipeModuleMap.set(r.CategoriaRecetario.toLowerCase().trim(), r.IdCategoriaRecetario);
        });

        // Current date for FechaAct
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Start transaction
        await connection.beginTransaction();

        let insertedCount = 0;
        for (const product of products) {
            const codigo = product.Codigo?.toString() || '';
            const nombre = product.Producto || '';
            const precio = parseFloat(product.Precio) || 0;
            const categoriaName = (product.Categoria || '').toLowerCase().trim();
            const moduloName = (product['Modulo Recetario'] || '').toLowerCase().trim();

            const idCategoria = categoryMap.get(categoriaName) || 0;
            const idModulo = recipeModuleMap.get(moduloName) || 0;

            await connection.query(
                `INSERT INTO tblProductos (Codigo, Producto, Precio, IdCategoria, IdCategoriaRecetario, Status, FechaAct, IdTipoProducto, PesoInicial, PesoFinal, ConversionSimple, CantidadCompra) 
                 VALUES (?, ?, ?, ?, ?, 0, ?, 0, 1, 1, 1, 1)`,
                [codigo, nombre, precio, idCategoria, idModulo, now]
            );
            insertedCount++;
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: `Se han insertado ${insertedCount} productos correctamente.`,
            count: insertedCount
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error processing massive product upload:', error);
        return NextResponse.json({ success: false, message: 'Error procesando la carga masiva' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
