import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export const runtime = 'nodejs';

/**
 * GET /api/sales/quotes/dishes?projectId
 * Lista los conceptos que se pueden cotizar en un evento, con su COSTO unitario:
 *   - Platillos (IdTipoProducto = 1) y Sub-recetas (IdTipoProducto = 2): el costo es
 *     el de su receta, igual que la pestaña de costeo: Σ(tblProductosKits.Cantidad ×
 *     vlProductos.Costo).
 *   - Productos / Insumos (IdTipoProducto = 0): el costo es su propio costo unitario
 *     (vlProductos.Costo).
 * Cada fila incluye `tipo` para agruparlos en el selector. Sirve para autollenar el
 * "costo unitario" al cotizar un evento.
 */
export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = parseInt(searchParams.get('projectId') || '');
        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Missing projectId', data: [] }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        const [rows] = await connection.query(
            `SELECT
                p.IdProducto     AS idPlatillo,
                p.Producto       AS platillo,
                p.Codigo         AS codigo,
                p.IdTipoProducto AS tipo,
                p.UnidadMedidaInventario AS unidad,
                ROUND(
                    CASE WHEN p.IdTipoProducto = 0
                         THEN COALESCE(self.Costo, 0)
                         ELSE COALESCE(SUM(k.Cantidad * child.Costo), 0)
                    END, 2) AS costo
             FROM tblProductos p
             LEFT JOIN vlProductos self     ON self.IdProducto = p.IdProducto
             LEFT JOIN tblProductosKits k   ON k.IdProductoPadre = p.IdProducto
             LEFT JOIN vlProductos child    ON child.IdProducto = k.IdProductoHijo
             WHERE p.IdTipoProducto IN (0, 1, 2) AND (p.Status IS NULL OR p.Status <> 2)
             GROUP BY p.IdProducto, p.Producto, p.Codigo, p.IdTipoProducto, p.UnidadMedidaInventario, self.Costo
             ORDER BY p.IdTipoProducto ASC, p.Producto ASC`
        );

        const data = (rows as RowDataPacket[]).map((r) => ({
            idPlatillo: Number(r.idPlatillo),
            platillo: String(r.platillo || ''),
            codigo: r.codigo ? String(r.codigo) : '',
            tipo: Number(r.tipo),
            unidad: r.unidad ? String(r.unidad) : '',
            costo: Number(r.costo) || 0,
        }));

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching dishes for quotes:', error);
        return NextResponse.json({ success: false, message: 'Error fetching dishes', data: [] }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
