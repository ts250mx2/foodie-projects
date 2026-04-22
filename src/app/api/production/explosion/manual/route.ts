import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

interface SubRecipeInput {
    productId: number;
    quantity: number;
}

interface ExplosionItem {
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
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, subRecipes } = body as { projectId: number; subRecipes: SubRecipeInput[] };

        if (!projectId || !subRecipes || !Array.isArray(subRecipes)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const activeSubRecipes = subRecipes.filter(sr => sr.quantity > 0);

        if (activeSubRecipes.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        connection = await getProjectConnection(projectId);

        const materialsMap: Record<number, ExplosionItem> = {};

        // Función recursiva para explotar subrecetas
        async function explode(parentId: number, parentQuantity: number) {
            const query = `
                SELECT 
                    pk.IdProductoPadre,
                    pk.IdProductoHijo,
                    pk.Cantidad / e.PesoFinal as CantidadBase,
                    p.*,
                    c.Categoria
                FROM tblProductosKits pk
                INNER JOIN vlProductos p ON pk.IdProductoHijo = p.IdProducto
                INNER JOIN tblProductos e ON pk.IdProductoPadre = e.IdProducto
                LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
                WHERE pk.IdProductoPadre = ?
            `;

            const [components] = await connection.query(query, [parentId]) as [RowDataPacket[], any];

            for (const comp of components) {
                const totalQty = comp.CantidadBase * parentQuantity;
                const totalCost = totalQty * (comp.Costo || 0);

                // Si el componente es una subreceta (IdTipoProducto = 2)
                if (comp.IdTipoProducto === 2) {
                    await explode(comp.IdProductoHijo, totalQty);
                } else {
                    // Si es un insumo normal, lo agregamos al mapa final
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
                }
            }
        }

        // Ejecutar explosión para cada subreceta inicial
        for (const input of activeSubRecipes) {
            await explode(input.productId, input.quantity);
        }

        // Convertir mapa a array y ordenar por categoría/producto
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
