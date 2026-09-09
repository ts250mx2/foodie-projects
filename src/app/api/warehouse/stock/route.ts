import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';
import { loadProductUnits, loadUnitsForProducts } from '@/lib/product-units';
import { baseUnit, unitFactor } from '@/lib/units';

/**
 * Existencias de almacén por sucursal (inventario perpetuo costeado).
 *  GET  → existencias + costo promedio + datos del producto (vlProductos).
 *  POST → ajuste manual (sumar/restar) con movimiento de kardex AJUSTE_MANUAL.
 */

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');

        if (!projectIdStr || !branchIdStr) {
            return NextResponse.json({ success: false, message: 'projectId and branchId are required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        // vlProductos divide entre PesoFinal; evita el error de división entre cero.
        await connection.query(
            "SET SESSION sql_mode = REPLACE(@@sql_mode, 'ERROR_FOR_DIVISION_BY_ZERO', '')"
        );

        // TODA la materia prima activa (IdTipoProducto=0), tenga o no movimientos
        // de almacén: LEFT JOIN con existencias de la sucursal (default 0).
        const [rows] = await connection.query(
            `SELECT
                v.IdProducto,
                COALESCE(e.Existencia, 0) AS Existencia,
                COALESCE(e.CostoPromedio, 0) AS CostoPromedio,
                e.Unidad,
                e.FechaAct,
                v.Producto,
                v.Codigo,
                v.IdCategoria,
                v.Categoria,
                v.ImagenCategoria,
                v.UnidadMedidaCompra,
                v.UnidadMedidaInventario,
                v.CostoInventario
             FROM vlProductos v
             LEFT JOIN tblAlmacenExistencias e
                ON e.IdProducto = v.IdProducto AND e.IdSucursal = ?
             WHERE v.IdTipoProducto = 0 AND v.Status = 0
             ORDER BY v.Categoria, v.Producto`,
            [parseInt(branchIdStr)]
        );

        // Presentaciones de cada insumo: la pantalla de ajustes deja contar en
        // la que se usa en la bodega ("3 botes") y aquí se convierte a base.
        const unitsByProduct = await loadUnitsForProducts(
            connection,
            (rows as RowDataPacket[]).map(r => Number(r.IdProducto))
        );
        const data = (rows as RowDataPacket[]).map(r => ({
            ...r,
            Unidades: unitsByProduct.get(Number(r.IdProducto)) || [],
        }));

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching warehouse stock:', error);
        return NextResponse.json({ success: false, message: 'Error fetching warehouse stock' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, idProducto, tipo, cantidad, costoUnitario, notas, unidad: unidadCaptura } = body;

        const qtyCaptura = Number(cantidad);
        if (!projectId || !branchId || !idProducto || !tipo) {
            return NextResponse.json({ success: false, message: 'Datos incompletos: se requiere producto, tipo y cantidad' }, { status: 400 });
        }
        if (tipo !== 'ENTRADA' && tipo !== 'SALIDA' && tipo !== 'AJUSTE') {
            return NextResponse.json({ success: false, message: 'Tipo de ajuste no válido' }, { status: 400 });
        }
        // ENTRADA/SALIDA: delta > 0. AJUSTE: existencia objetivo (acepta 0, no negativos).
        if (tipo === 'AJUSTE') {
            if (isNaN(qtyCaptura) || qtyCaptura < 0) {
                return NextResponse.json({ success: false, message: 'La nueva existencia no puede ser negativa' }, { status: 400 });
            }
        } else if (!qtyCaptura || qtyCaptura <= 0) {
            return NextResponse.json({ success: false, message: 'Captura una cantidad mayor a cero' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));
        await connection.beginTransaction();

        // El conteo se puede capturar en cualquier presentación ("3 botes y
        // medio") pero el almacén siempre guarda la base. Sin presentaciones
        // configuradas el factor es 1 y todo queda igual que antes.
        const units = await loadProductUnits(connection, Number(idProducto));
        const factor = unitFactor(units, unidadCaptura);
        const convertido = factor !== 1;
        const qty = qtyCaptura * factor;

        const [exRows] = await connection.query(
            'SELECT Existencia, CostoPromedio, Unidad FROM tblAlmacenExistencias WHERE IdSucursal = ? AND IdProducto = ? FOR UPDATE',
            [branchId, idProducto]
        );
        const existing = (exRows as any[])[0];
        const prev = existing ? Number(existing.Existencia) : 0;
        const avg = existing ? Number(existing.CostoPromedio) : 0;
        // El costo capturado es por unidad capturada: se divide por el mismo
        // factor por el que se multiplicó la cantidad.
        const inputCost = factor > 0 ? (Number(costoUnitario) || 0) / factor : (Number(costoUnitario) || 0);

        let costo: number;
        let nueva: number;
        let nuevoPromedio: number;
        let movTipo: 'ENTRADA' | 'SALIDA' = tipo === 'SALIDA' ? 'SALIDA' : 'ENTRADA';
        let movQty = qty;
        let movNotas: string | null = notas || null;

        if (tipo === 'AJUSTE') {
            // Establece la existencia exacta; el kardex registra la diferencia.
            const delta = qty - prev;
            nueva = qty;
            nuevoPromedio = inputCost > 0 ? inputCost : avg;
            if (delta === 0) {
                if (inputCost > 0 && inputCost !== avg) {
                    await connection.query(
                        `INSERT INTO tblAlmacenExistencias (IdSucursal, IdProducto, Existencia, CostoPromedio, FechaAct)
                         VALUES (?, ?, ?, ?, Now())
                         ON DUPLICATE KEY UPDATE CostoPromedio = ?, FechaAct = Now()`,
                        [branchId, idProducto, nueva, nuevoPromedio, nuevoPromedio]
                    );
                    await connection.commit();
                    return NextResponse.json({ success: true, data: { existencia: nueva, costoPromedio: nuevoPromedio } });
                }
                await connection.rollback();
                return NextResponse.json({ success: true, data: { existencia: prev, costoPromedio: avg }, message: 'La existencia ya era esa cantidad' });
            }
            movTipo = delta > 0 ? 'ENTRADA' : 'SALIDA';
            movQty = Math.abs(delta);
            costo = movTipo === 'ENTRADA'
                ? (inputCost > 0 ? inputCost : avg)
                : (avg > 0 ? avg : inputCost);
            movNotas = convertido
                ? `Ajuste de inventario: ${qtyCaptura} ${unidadCaptura} = ${qty}${notas ? ` — ${notas}` : ''}`
                : `Ajuste de inventario: existencia establecida en ${qty}${notas ? ` — ${notas}` : ''}`;
        } else if (tipo === 'SALIDA') {
            costo = avg > 0 ? avg : inputCost;
            nueva = prev - qty;
            nuevoPromedio = avg;
        } else {
            costo = inputCost > 0 ? inputCost : avg;
            nueva = prev + qty;
            nuevoPromedio = prev > 0 && avg > 0
                ? ((prev * avg) + (qty * costo)) / (prev + qty)
                : costo;
        }

        // Unidad: manda la base del producto — es la que quedará en existencias
        // tras el corte físico. Sin presentaciones, conserva la registrada.
        let unidad: string | null = baseUnit(units)?.unidad || existing?.Unidad || null;
        if (!unidad) {
            const [prodRows] = await connection.query(
                'SELECT UnidadMedidaInventario, UnidadMedidaCompra FROM tblProductos WHERE IdProducto = ?',
                [idProducto]
            );
            const prod = (prodRows as any[])[0];
            unidad = prod?.UnidadMedidaInventario || prod?.UnidadMedidaCompra || null;
        }

        await connection.query(
            `INSERT INTO tblAlmacenMovimientos
                (IdSucursal, IdProducto, TipoMovimiento, Origen, IdOrdenCompra, Cantidad, CostoUnitario,
                 ExistenciaAnterior, ExistenciaNueva, Unidad, CantidadCaptura, UnidadCaptura,
                 Notas, FechaMovimiento, FechaAct)
             VALUES (?, ?, ?, 'AJUSTE_MANUAL', NULL, ?, ?, ?, ?, ?, ?, ?, ?, Now(), Now())`,
            [
                branchId, idProducto, movTipo, movQty, costo, prev, nueva, unidad,
                convertido ? qtyCaptura : null,
                convertido ? unidadCaptura : null,
                movNotas,
            ]
        );

        await connection.query(
            `INSERT INTO tblAlmacenExistencias (IdSucursal, IdProducto, Existencia, CostoPromedio, Unidad, FechaAct)
             VALUES (?, ?, ?, ?, ?, Now())
             ON DUPLICATE KEY UPDATE Existencia = ?, CostoPromedio = ?, Unidad = COALESCE(?, Unidad), FechaAct = Now()`,
            [branchId, idProducto, nueva, nuevoPromedio, unidad, nueva, nuevoPromedio, unidad]
        );

        await connection.commit();
        return NextResponse.json({ success: true, data: { existencia: nueva, costoPromedio: nuevoPromedio } });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error('Error applying warehouse adjustment:', error);
        return NextResponse.json({ success: false, message: 'Error al aplicar el ajuste de almacén' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
