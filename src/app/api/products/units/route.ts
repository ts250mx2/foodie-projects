import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';
import { loadProductUnits, saveProductUnits } from '@/lib/product-units';
import { ProductUnit, suggestUnits } from '@/lib/units';

export const runtime = 'nodejs';

/**
 * Presentaciones (unidades de medida) de un producto.
 *
 * GET  → las configuradas, una propuesta armada con lo que ya tiene el
 *        catálogo, y la existencia actual por sucursal — que es lo que hay que
 *        recontar si se cambia la unidad base.
 * PUT  → reemplaza el juego completo de presentaciones.
 */

export async function GET(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = Number(searchParams.get('projectId'));
        const productId = Number(searchParams.get('productId'));

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }
        if (!Number.isInteger(productId) || productId <= 0) {
            return NextResponse.json({ success: false, message: 'Product ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        const [prodRows] = await connection.query<RowDataPacket[]>(
            `SELECT IdProducto, Producto, CantidadCompra, UnidadMedidaCompra, UnidadMedidaInventario,
                    UnidadMedidaRecetario
               FROM tblProductos WHERE IdProducto = ?`,
            [productId]
        );
        const producto = prodRows[0];
        if (!producto) {
            return NextResponse.json({ success: false, message: 'Producto no encontrado' }, { status: 404 });
        }

        const units = await loadProductUnits(connection, productId);

        // Existencia viva: si ya hay inventario, cambiar la base obliga a un
        // corte físico. La UI lo advierte con estos números.
        const [stockRows] = await connection.query<RowDataPacket[]>(
            `SELECT e.IdSucursal, s.Sucursal, e.Existencia, e.CostoPromedio, e.Unidad
               FROM tblAlmacenExistencias e
               LEFT JOIN tblSucursales s ON s.IdSucursal = e.IdSucursal
              WHERE e.IdProducto = ? AND e.Existencia <> 0
              ORDER BY s.Sucursal`,
            [productId]
        );

        // Nombres de unidad ya usados en el proyecto: alimentan el autocompletado
        // para que nadie escriba "GRS", "GRAMOS" y "GRAMO" como tres unidades.
        const [presRows] = await connection.query<RowDataPacket[]>(
            'SELECT Presentacion FROM tblPresentaciones WHERE Status = 0 ORDER BY Presentacion'
        );

        return NextResponse.json({
            success: true,
            producto: {
                idProducto: producto.IdProducto,
                producto: producto.Producto,
                cantidadCompra: Number(producto.CantidadCompra) || 0,
                unidadCompra: producto.UnidadMedidaCompra || null,
                unidadInventario: producto.UnidadMedidaInventario || null,
                unidadRecetario: producto.UnidadMedidaRecetario || null,
            },
            units,
            sugerencia: units.length === 0 ? suggestUnits(producto as never) : [],
            existencias: stockRows.map(r => ({
                idSucursal: r.IdSucursal,
                sucursal: r.Sucursal || `Sucursal ${r.IdSucursal}`,
                existencia: Number(r.Existencia) || 0,
                costoPromedio: Number(r.CostoPromedio) || 0,
                unidad: r.Unidad || null,
            })),
            catalogoUnidades: presRows.map(r => String(r.Presentacion)),
        });
    } catch (error) {
        console.error('Error loading product units:', error);
        return NextResponse.json({ success: false, message: 'Error al cargar las presentaciones' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const body = await request.json();
        const projectId = Number(body.projectId);
        const productId = Number(body.productId);
        const units: ProductUnit[] = Array.isArray(body.units) ? body.units : [];

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }
        if (!Number.isInteger(productId) || productId <= 0) {
            return NextResponse.json({ success: false, message: 'Product ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        await connection.beginTransaction();

        const result = await saveProductUnits(connection, productId, units);
        if (result.ok === false) {
            const message = result.message;
            await connection.rollback();
            return NextResponse.json({ success: false, message }, { status: 400 });
        }

        // La unidad base es la que manda en el almacén: se refleja en el
        // catálogo para que las pantallas que aún leen UnidadMedidaInventario
        // digan lo mismo que el kardex.
        const base = units.find(u => u.esBase);
        const compra = units.find(u => u.esCompra);
        if (base) {
            await connection.query(
                `UPDATE tblProductos
                    SET UnidadMedidaInventario = ?,
                        UnidadMedidaCompra = COALESCE(?, UnidadMedidaCompra),
                        CantidadCompra = ?,
                        FechaAct = Now()
                  WHERE IdProducto = ?`,
                [base.unidad, compra?.unidad || null, compra ? Number(compra.factor) || 1 : 1, productId]
            );
        }

        await connection.commit();

        const saved = await loadProductUnits(connection, productId);
        return NextResponse.json({ success: true, units: saved });
    } catch (error) {
        console.error('Error saving product units:', error);
        if (connection) {
            try { await connection.rollback(); } catch { /* la conexión ya venía rota */ }
        }
        return NextResponse.json({ success: false, message: 'Error al guardar las presentaciones' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
