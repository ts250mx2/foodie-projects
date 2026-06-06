import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

/**
 * GET /api/config/break-even/products?projectId[&inspect=1]
 *   Lista de productos de tipo platillo (tblProductos.IdTipoProducto = 1) con su costo
 *   de materia prima y empaque, para agregarlos como productos representativos del
 *   análisis de punto de equilibrio.
 */
export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = parseInt(searchParams.get('projectId') || '');
        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Missing projectId', products: [] }, { status: 400 });
        }
        connection = await getProjectConnection(projectId);

        // Costo por platillo desde su receta (tblProductosKits × vlProductos.Costo),
        // separado por módulo de recetario: IdModuloRecetario = 2 → Empaque; el resto →
        // Materia Prima (Alimentos y Bebidas). Así materiaPrima + empaque = costo total.
        const [rows] = await connection.query(
            `SELECT
                p.IdProducto AS idProducto,
                p.Producto   AS producto,
                p.Codigo     AS codigo,
                ROUND(COALESCE(SUM(CASE WHEN child.IdModuloRecetario = 2
                        THEN k.Cantidad * child.Costo ELSE 0 END), 0), 2) AS empaque,
                ROUND(COALESCE(SUM(CASE WHEN child.IdModuloRecetario <> 2 OR child.IdModuloRecetario IS NULL
                        THEN k.Cantidad * child.Costo ELSE 0 END), 0), 2) AS materiaPrima
             FROM tblProductos p
             LEFT JOIN tblProductosKits k ON k.IdProductoPadre = p.IdProducto
             LEFT JOIN vlProductos child  ON child.IdProducto = k.IdProductoHijo
             WHERE p.IdTipoProducto = 1 AND (p.Status IS NULL OR p.Status <> 2)
             GROUP BY p.IdProducto, p.Producto, p.Codigo
             ORDER BY p.Producto ASC`
        );

        const products = (rows as RowDataPacket[]).map(r => ({
            idProducto: Number(r.idProducto),
            producto: String(r.producto || ''),
            codigo: r.codigo ? String(r.codigo) : '',
            materiaPrima: Number(r.materiaPrima) || 0,
            empaque: Number(r.empaque) || 0,
        }));

        return NextResponse.json({ success: true, products });
    } catch (error) {
        console.error('Error fetching break-even products:', error);
        return NextResponse.json({ success: false, message: 'Error fetching products', products: [] }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
