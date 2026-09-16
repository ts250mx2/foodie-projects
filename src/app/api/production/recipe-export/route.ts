import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';

export const runtime = 'nodejs';

/**
 * Ingredientes de TODOS los platillos (tipo 1) o subrecetas (tipo 2) de un
 * proyecto, en una sola consulta.
 *
 * Existe para la exportación con detalle: pedirle los ingredientes uno por uno
 * a /api/production/costing significaría una petición por receta — en un
 * recetario de 300 platillos, 300 viajes al servidor para armar un PDF.
 *
 * Usa la misma fórmula de costo que la pantalla de costeo (vlProductos.Costo
 * por la cantidad de la receta) para que el reporte no contradiga al modal.
 */

/** 1 = platillo, 2 = subreceta. Son los únicos que llevan receta. */
const TIPOS_CON_RECETA = [1, 2];

export async function GET(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = Number(searchParams.get('projectId'));
        const tipoProducto = Number(searchParams.get('tipoProducto'));

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }
        if (!TIPOS_CON_RECETA.includes(tipoProducto)) {
            return NextResponse.json({ success: false, message: 'Tipo de producto no válido' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT
                B.IdProductoPadre,
                A.IdProducto AS IdProductoHijo,
                A.Producto,
                A.Codigo,
                B.Cantidad,
                A.UnidadMedidaInventario,
                A.UnidadMedidaRecetario,
                A.Costo,
                (B.Cantidad * A.Costo) AS Total,
                A.IdModuloRecetario
             FROM vlProductos A
             INNER JOIN tblProductosKits B ON A.IdProducto = B.IdProductoHijo
             INNER JOIN tblProductos padre ON padre.IdProducto = B.IdProductoPadre
             WHERE padre.IdTipoProducto = ? AND padre.Status = 0
             ORDER BY B.IdProductoPadre, A.IdModuloRecetario, A.Producto`,
            [tipoProducto]
        );

        return NextResponse.json({
            success: true,
            data: rows.map(r => ({
                idProductoPadre: Number(r.IdProductoPadre),
                idProducto: Number(r.IdProductoHijo),
                producto: r.Producto,
                codigo: r.Codigo || '',
                cantidad: Number(r.Cantidad) || 0,
                // La de recetario es la que se usa al capturar la receta; si no
                // está definida se cae a la de inventario.
                unidad: r.UnidadMedidaRecetario || r.UnidadMedidaInventario || '',
                costo: Number(r.Costo) || 0,
                total: Number(r.Total) || 0,
            })),
        });
    } catch (error) {
        console.error('Error fetching recipe export detail:', error);
        return NextResponse.json({ success: false, message: 'Error al cargar el detalle de las recetas' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
