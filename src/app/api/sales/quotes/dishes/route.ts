import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export const runtime = 'nodejs';

/**
 * GET /api/sales/quotes/dishes?projectId
 * Lista los platillos (tblProductos.IdTipoProducto = 1) con su COSTO de costeo,
 * tomado igual que la pestaña de costeo del modal: la suma de su receta
 * (tblProductosKits.Cantidad × vlProductos.Costo). Sirve para autollenar el
 * "costo por platillo" al cotizar un evento.
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
                p.IdProducto AS idPlatillo,
                p.Producto   AS platillo,
                p.Codigo     AS codigo,
                ROUND(COALESCE(SUM(k.Cantidad * child.Costo), 0), 2) AS costo
             FROM tblProductos p
             LEFT JOIN tblProductosKits k ON k.IdProductoPadre = p.IdProducto
             LEFT JOIN vlProductos child  ON child.IdProducto = k.IdProductoHijo
             WHERE p.IdTipoProducto = 1 AND (p.Status IS NULL OR p.Status <> 2)
             GROUP BY p.IdProducto, p.Producto, p.Codigo
             ORDER BY p.Producto ASC`
        );

        const data = (rows as RowDataPacket[]).map((r) => ({
            idPlatillo: Number(r.idPlatillo),
            platillo: String(r.platillo || ''),
            codigo: r.codigo ? String(r.codigo) : '',
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
