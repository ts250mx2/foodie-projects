import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';
import { guardarConteoZona } from '@/lib/inventory-zones';

export const runtime = 'nodejs';

/**
 * Conteo de una zona para un día.
 *
 * GET → los insumos que toca contar en esa zona, con lo que ya se contó AHÍ y
 *       el total acumulado entre todas las zonas.
 * PUT → guarda el conteo de la zona y recalcula el total de cada producto.
 *
 * El mes entra 0-11 (como lo maneja el cliente) y se guarda 1-12, igual que
 * tblInventarios.
 */

export async function GET(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = Number(searchParams.get('projectId'));
        const branchId = Number(searchParams.get('branchId'));
        const zoneId = Number(searchParams.get('zoneId'));
        const day = Number(searchParams.get('day'));
        const month = Number(searchParams.get('month'));
        const year = Number(searchParams.get('year'));

        if (![projectId, branchId, zoneId, year].every(n => Number.isInteger(n) && n > 0)
            || !Number.isInteger(day) || !Number.isInteger(month)) {
            return NextResponse.json({ success: false, message: 'Parámetros incompletos' }, { status: 400 });
        }

        const mes = month + 1;
        connection = await getProjectConnection(projectId);
        await connection.query("SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, 'ERROR_FOR_DIVISION_BY_ZERO', ''))");

        // Se parte de tblInventarios porque ahí está la lista del día ya
        // inicializada; la zona solo acota QUÉ se cuenta y CON QUÉ cantidad.
        //
        // El filtro es: los productos de esta zona, MÁS los que no están
        // asignados a ninguna zona de la sucursal — esos aparecen en todas para
        // que nada se quede sin contar por un olvido de configuración.
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT I.IdProducto,
                    COALESCE(z.Cantidad, 0) AS Cantidad,
                    COALESCE(tz.Total, 0) AS CantidadTotal,
                    (z.IdProducto IS NOT NULL) AS ContadoEnZona,
                    COALESCE(v.CostoInventario, I.Precio) AS Precio,
                    I.FechaInventario, I.Dia, I.Mes, I.Anio, I.IdSucursal,
                    v.Codigo AS Codigo, v.Producto AS Producto,
                    v.UnidadMedidaInventario AS Presentacion,
                    v.IdCategoria AS IdCategoria,
                    v.Categoria AS Categoria,
                    v.ImagenCategoria AS ImagenCategoria,
                    v.ArchivoImagen AS ArchivoImagen,
                    (COALESCE(z.Cantidad, 0) * COALESCE(v.CostoInventario, I.Precio)) AS Total
             FROM tblInventarios I
             INNER JOIN tblProductos p ON I.IdProducto = p.IdProducto
             LEFT JOIN vlProductos v ON I.IdProducto = v.IdProducto
             LEFT JOIN tblInventariosZonas z
                    ON z.IdProducto = I.IdProducto AND z.Dia = I.Dia AND z.Mes = I.Mes
                   AND z.Anio = I.Anio AND z.IdSucursal = I.IdSucursal AND z.IdZona = ?
             LEFT JOIN (
                    SELECT IdProducto, SUM(Cantidad) AS Total
                      FROM tblInventariosZonas
                     WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdSucursal = ?
                     GROUP BY IdProducto
             ) tz ON tz.IdProducto = I.IdProducto
             WHERE I.IdSucursal = ? AND I.Dia = ? AND I.Mes = ? AND I.Anio = ?
               AND p.Status != 2
               AND (
                    I.IdProducto IN (SELECT IdProducto FROM tblZonasProductos WHERE IdZona = ?)
                    OR I.IdProducto NOT IN (
                        SELECT zp.IdProducto FROM tblZonasProductos zp
                        INNER JOIN tblZonas z2 ON z2.IdZona = zp.IdZona
                        WHERE z2.IdSucursal = ? AND z2.Status = 0
                    )
               )
             ORDER BY v.Categoria, v.Producto`,
            [zoneId, day, mes, year, branchId, branchId, day, mes, year, zoneId, branchId]
        );

        return NextResponse.json({
            success: true,
            data: rows.map(r => ({
                ...r,
                // MySQL devuelve el booleano como 0/1.
                ContadoEnZona: Number(r.ContadoEnZona) === 1,
            })),
        });
    } catch (error) {
        console.error('Error fetching zone inventory:', error);
        return NextResponse.json({ success: false, message: 'Error al cargar el conteo de la zona' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const body = await request.json();
        const projectId = Number(body.projectId);
        const branchId = Number(body.branchId);
        const zoneId = Number(body.zoneId);
        const day = Number(body.day);
        const month = Number(body.month);
        const year = Number(body.year);
        const inventoryDate = String(body.inventoryDate || '');
        const conteos = Array.isArray(body.conteos) ? body.conteos : [];

        if (![projectId, branchId, zoneId, year].every(n => Number.isInteger(n) && n > 0)
            || !Number.isInteger(day) || !Number.isInteger(month) || !inventoryDate) {
            return NextResponse.json({ success: false, message: 'Parámetros incompletos' }, { status: 400 });
        }

        const limpios = conteos
            .map((c: { productId: unknown; cantidad: unknown }) => {
                const idProducto = Number(c?.productId);
                if (!Number.isInteger(idProducto) || idProducto <= 0) return null;
                // null = "no conté aquí", que no es lo mismo que contar cero.
                const cantidad = c?.cantidad === null || c?.cantidad === '' || c?.cantidad === undefined
                    ? null
                    : Number(c.cantidad);
                if (cantidad !== null && !Number.isFinite(cantidad)) return null;
                return { idProducto, cantidad };
            })
            .filter((c): c is { idProducto: number; cantidad: number | null } => c !== null);

        if (limpios.length === 0) {
            return NextResponse.json({ success: true, totales: {} });
        }

        connection = await getProjectConnection(projectId);
        await connection.query("SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, 'ERROR_FOR_DIVISION_BY_ZERO', ''))");
        await connection.beginTransaction();

        try {
            const totales = await guardarConteoZona(connection, {
                idZona: zoneId,
                dia: day,
                mes: month + 1,
                anio: year,
                idSucursal: branchId,
                fechaInventario: inventoryDate,
                conteos: limpios.map(c => ({ idProducto: c.idProducto, cantidad: c.cantidad })),
            });

            await connection.commit();

            return NextResponse.json({
                success: true,
                totales: Object.fromEntries(totales),
            });
        } catch (e) {
            await connection.rollback();
            throw e;
        }
    } catch (error) {
        console.error('Error saving zone inventory:', error);
        return NextResponse.json({ success: false, message: 'Error al guardar el conteo de la zona' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
