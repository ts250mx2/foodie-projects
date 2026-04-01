import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

interface SubRecipeInput {
    productId: number;
    quantity: number;
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, subRecipes } = body as { projectId: number; subRecipes: SubRecipeInput[] };

        if (!projectId || !subRecipes || !Array.isArray(subRecipes)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        // Filter out zero quantities
        const activeSubRecipes = subRecipes.filter(sr => sr.quantity > 0);

        if (activeSubRecipes.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        connection = await getProjectConnection(projectId);

        // We need to fetch all components for all active sub-recipes
        const productIds = activeSubRecipes.map(sr => sr.productId);
        
        // This query gets the components (children) of the sub-recipes (parents)
        const [components] = await connection.query(`
            SELECT 
                pk.IdProductoPadre,
                pk.IdProductoHijo,
                pk.Cantidad as CantidadBase,
                p.*,
                c.Categoria
            FROM tblProductosKits pk
            INNER JOIN vlProductos p ON pk.IdProductoHijo = p.IdProducto
            LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
            WHERE pk.IdProductoPadre IN (?)
        `, [productIds]) as [RowDataPacket[], any];

        // Group and aggregate
        const materialsMap: Record<number, {
            productId: number;
            product: string;
            code: string;
            quantity: number;
            unit: string;
            price: number;
            total: number;
            category: string;
            productType: number;
            productData: any;
        }> = {};

        activeSubRecipes.forEach(input => {
            const recipeComponents = components.filter(c => c.IdProductoPadre === input.productId);
            
            recipeComponents.forEach(comp => {
                const totalQty = comp.CantidadBase * input.quantity;
                const totalCost = totalQty * (comp.Costo || 0);

                if (materialsMap[comp.IdProductoHijo]) {
                    materialsMap[comp.IdProductoHijo].quantity += totalQty;
                    materialsMap[comp.IdProductoHijo].total += totalCost;
                } else {
                    materialsMap[comp.IdProductoHijo] = {
                        productId: comp.IdProductoHijo,
                        product: comp.Producto,
                        code: comp.Codigo,
                        quantity: totalQty,
                        unit: comp.UnidadMedidaRecetario || comp.UnidadMedidaInventario || 'pza',
                        price: comp.Costo || 0,
                        total: totalCost,
                        category: comp.Categoria || 'General',
                        productType: comp.IdTipoProducto,
                        productData: { ...comp }
                    };
                }
            });
        });

        // Convert map to array and sort by category/product
        const result = Object.values(materialsMap).sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return a.product.localeCompare(b.product);
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error('Error in manual material explosion:', error);
        return NextResponse.json({ success: false, message: 'Error calculating explosion' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
