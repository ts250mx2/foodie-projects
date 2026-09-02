import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';

export const runtime = 'nodejs';

/**
 * Buscador de compras capturadas.
 *
 * Busca en un solo lugar lo que la gente tiene a la mano cuando anda cazando
 * una factura: el nombre del proveedor, el número de factura o el producto que
 * venía dentro. Devuelve los DOCUMENTOS donde apareció, diciendo por cuál de
 * los tres coincidió y, si fue por producto, cuáles.
 *
 * También sirve para el aviso de factura repetida: con `invoice` hace la
 * comparación exacta en vez de la búsqueda parcial.
 */

/** Tope de resultados: la búsqueda es para encontrar, no para exportar. */
const MAX_RESULTS = 100;
const MIN_QUERY_LEN = 2;

export async function GET(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = Number(searchParams.get('projectId'));
        const q = (searchParams.get('q') || '').trim();
        const invoice = (searchParams.get('invoice') || '').trim();
        const branchId = Number(searchParams.get('branchId'));
        const excludeId = Number(searchParams.get('excludeId'));

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        // Modo factura exacta: es el que usa el aviso de duplicados al guardar.
        if (invoice) {
            connection = await getProjectConnection(projectId);
            const [rows] = await connection.query<RowDataPacket[]>(
                `SELECT c.IdCompra, c.FechaCompra, c.NumeroFactura, c.Total, c.IdSucursal, c.IdProveedor,
                        p.Proveedor, s.Sucursal
                 FROM tblCompras c
                 INNER JOIN tblProveedores p ON c.IdProveedor = p.IdProveedor
                 LEFT JOIN tblSucursales s ON c.IdSucursal = s.IdSucursal
                 WHERE c.Status <> 2 AND UPPER(c.NumeroFactura) = UPPER(?)
                   ${Number.isInteger(excludeId) && excludeId > 0 ? 'AND c.IdCompra <> ?' : ''}
                 ORDER BY c.FechaCompra DESC
                 LIMIT 20`,
                Number.isInteger(excludeId) && excludeId > 0 ? [invoice, excludeId] : [invoice]
            );

            return NextResponse.json({
                success: true,
                invoice,
                matches: rows.map(r => ({
                    idCompra: r.IdCompra,
                    fecha: r.FechaCompra,
                    numeroFactura: r.NumeroFactura,
                    total: Number(r.Total) || 0,
                    proveedor: r.Proveedor,
                    idProveedor: r.IdProveedor,
                    idSucursal: r.IdSucursal,
                    sucursal: r.Sucursal,
                })),
            });
        }

        if (q.length < MIN_QUERY_LEN) {
            return NextResponse.json({ success: true, query: q, results: [], truncated: false });
        }

        const like = `%${q}%`;
        connection = await getProjectConnection(projectId);

        // Un renglón por compra. El CASE dentro del GROUP_CONCAT deja solo los
        // productos que coincidieron, no todo el contenido del documento.
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT c.IdCompra, c.FechaCompra, c.NumeroFactura, c.Total, c.Referencia, c.PagarA,
                    c.IdSucursal, s.Sucursal, p.Proveedor,
                    MAX(CASE WHEN p.Proveedor LIKE ? THEN 1 ELSE 0 END) AS PorProveedor,
                    MAX(CASE WHEN c.NumeroFactura LIKE ? THEN 1 ELSE 0 END) AS PorFactura,
                    MAX(CASE WHEN pr.Producto LIKE ? THEN 1 ELSE 0 END) AS PorProducto,
                    GROUP_CONCAT(DISTINCT CASE WHEN pr.Producto LIKE ? THEN pr.Producto END SEPARATOR ' · ') AS ProductosCoinciden
             FROM tblCompras c
             INNER JOIN tblProveedores p ON c.IdProveedor = p.IdProveedor
             LEFT JOIN tblSucursales s ON c.IdSucursal = s.IdSucursal
             LEFT JOIN tblDetalleCompras d ON d.IdCompra = c.IdCompra AND (d.Status IS NULL OR d.Status <> 2)
             LEFT JOIN tblProductos pr ON pr.IdProducto = d.IdProducto
             WHERE c.Status <> 2
               ${Number.isInteger(branchId) && branchId > 0 ? 'AND c.IdSucursal = ?' : ''}
               AND (p.Proveedor LIKE ? OR c.NumeroFactura LIKE ? OR pr.Producto LIKE ?)
             GROUP BY c.IdCompra, c.FechaCompra, c.NumeroFactura, c.Total, c.Referencia, c.PagarA,
                      c.IdSucursal, s.Sucursal, p.Proveedor
             ORDER BY c.FechaCompra DESC, c.IdCompra DESC
             LIMIT ${MAX_RESULTS + 1}`,
            Number.isInteger(branchId) && branchId > 0
                ? [like, like, like, like, branchId, like, like, like]
                : [like, like, like, like, like, like, like]
        );

        const truncated = rows.length > MAX_RESULTS;
        const results = rows.slice(0, MAX_RESULTS).map(r => ({
            idCompra: r.IdCompra,
            fecha: r.FechaCompra,
            numeroFactura: r.NumeroFactura,
            total: Number(r.Total) || 0,
            referencia: r.Referencia || null,
            pagarA: r.PagarA || null,
            idSucursal: r.IdSucursal,
            sucursal: r.Sucursal || null,
            proveedor: r.Proveedor,
            // Por qué salió en la búsqueda: lo pinta la UI como etiquetas.
            porProveedor: Number(r.PorProveedor) === 1,
            porFactura: Number(r.PorFactura) === 1,
            porProducto: Number(r.PorProducto) === 1,
            productosCoinciden: r.ProductosCoinciden || null,
        }));

        return NextResponse.json({ success: true, query: q, results, truncated });
    } catch (error) {
        console.error('Error searching purchases:', error);
        return NextResponse.json({ success: false, message: 'Error al buscar compras' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
