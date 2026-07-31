import { Connection } from 'mysql2/promise';
import { ResultSetHeader } from 'mysql2';

/**
 * Lógica compartida del almacén (inventario perpetuo por sucursal).
 *
 * Estados de tblOrdenesCompra:
 *  0 En Tránsito (legado) · 1 Surtido/Aplicada · 2 Eliminada · 3 Cancelada ·
 *  4 Fantasma (pendiente de aplicar) · 5 Descartada.
 * Una orden con FechaAplicacion != NULL ya afectó el inventario.
 *
 * Las órdenes generadas desde la captura de compras llevan el marcador
 * "[Compra #N]" al inicio de Notas (mismo formato que el script
 * scripts/migrate-compras-a-ordenes.js) y se mantienen sincronizadas con
 * los renglones de la compra.
 */

export const OC_STATUS_APPLIED = 1;
export const OC_STATUS_DELETED = 2;
export const OC_STATUS_PHANTOM = 4;
export const OC_STATUS_DISCARDED = 5;

export type MovementInput = {
    idSucursal: number;
    idProducto: number;
    tipo: 'ENTRADA' | 'SALIDA';
    origen: 'ORDEN_COMPRA' | 'SALIDA_INTERNA' | 'AJUSTE_MANUAL';
    idOrdenCompra?: number | null;
    cantidad: number;
    /** Costo del renglón (entradas). Las salidas descargan al costo promedio vigente. */
    costoUnitario?: number;
    unidad?: string | null;
    notas?: string | null;
};

export type MovementResult = {
    existenciaAnterior: number;
    existenciaNueva: number;
    costoAplicado: number;
    costoPromedio: number;
};

/**
 * Registra UN movimiento de kardex y actualiza existencia + costo promedio
 * ponderado de la sucursal. Debe llamarse dentro de una transacción abierta.
 */
export async function registerWarehouseMovement(
    connection: Connection,
    input: MovementInput
): Promise<MovementResult> {
    const qty = Number(input.cantidad) || 0;
    const inputCost = Number(input.costoUnitario) || 0;

    const [exRows] = await connection.query(
        'SELECT Existencia, CostoPromedio, Unidad FROM tblAlmacenExistencias WHERE IdSucursal = ? AND IdProducto = ? FOR UPDATE',
        [input.idSucursal, input.idProducto]
    );
    const existing = (exRows as any[])[0];
    const prev = existing ? Number(existing.Existencia) : 0;
    const avg = existing ? Number(existing.CostoPromedio) : 0;

    let costo: number;
    let nueva: number;
    let nuevoPromedio: number;

    if (input.tipo === 'SALIDA') {
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

    // Unidad: la indicada → la ya registrada → la del catálogo del producto.
    let unidad: string | null = input.unidad || existing?.Unidad || null;
    if (!unidad) {
        const [prodRows] = await connection.query(
            'SELECT UnidadMedidaCompra, UnidadMedidaInventario FROM tblProductos WHERE IdProducto = ?',
            [input.idProducto]
        );
        const prod = (prodRows as any[])[0];
        unidad = prod?.UnidadMedidaCompra || prod?.UnidadMedidaInventario || null;
    }

    await connection.query(
        `INSERT INTO tblAlmacenMovimientos
            (IdSucursal, IdProducto, TipoMovimiento, Origen, IdOrdenCompra, Cantidad, CostoUnitario,
             ExistenciaAnterior, ExistenciaNueva, Unidad, Notas, FechaMovimiento, FechaAct)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, Now(), Now())`,
        [
            input.idSucursal,
            input.idProducto,
            input.tipo,
            input.origen,
            input.idOrdenCompra || null,
            qty,
            costo,
            prev,
            nueva,
            unidad,
            input.notas || null,
        ]
    );

    await connection.query(
        `INSERT INTO tblAlmacenExistencias (IdSucursal, IdProducto, Existencia, CostoPromedio, Unidad, FechaAct)
         VALUES (?, ?, ?, ?, ?, Now())
         ON DUPLICATE KEY UPDATE Existencia = ?, CostoPromedio = ?, Unidad = COALESCE(?, Unidad), FechaAct = Now()`,
        [input.idSucursal, input.idProducto, nueva, nuevoPromedio, unidad, nueva, nuevoPromedio, unidad]
    );

    return { existenciaAnterior: prev, existenciaNueva: nueva, costoAplicado: costo, costoPromedio: nuevoPromedio };
}

/**
 * Aplica una orden completa al almacén (un movimiento por renglón).
 * `items` son renglones de tblOrdenesCompraDetalle unidos con tblProductos
 * (UnidadMedidaCompra / UnidadMedidaInventario). Debe llamarse dentro de una
 * transacción abierta; NO cambia el Status de la orden (eso lo hace el caller).
 */
export async function applyOrderToWarehouse(connection: Connection, order: any, items: any[]) {
    const esSalida = Number(order.EsSalida) === 1;
    const folio = `OC-${String(order.IdOrdenCompra).padStart(4, '0')}`;

    for (const item of items) {
        const qty = Number(item.Cantidad) || 0;
        if (qty <= 0) continue;

        const unidad = item.UnidadMedidaPedido
            || (esSalida ? item.UnidadMedidaInventario : item.UnidadMedidaCompra)
            || null;

        await registerWarehouseMovement(connection, {
            idSucursal: order.IdSucursal,
            idProducto: item.IdProducto,
            tipo: esSalida ? 'SALIDA' : 'ENTRADA',
            origen: esSalida ? 'SALIDA_INTERNA' : 'ORDEN_COMPRA',
            idOrdenCompra: order.IdOrdenCompra,
            cantidad: qty,
            costoUnitario: Number(item.PrecioUnitario) || 0,
            unidad,
            notas: `Aplicación de ${folio}`,
        });
    }
}

/** Marcador en Notas que liga una orden con su compra capturada. */
const compraMarker = (idCompra: number) => `[Compra #${idCompra}]`;

/** Busca la orden ligada a una compra capturada (excluye eliminadas). */
export async function findOrderForCompra(connection: Connection, idCompra: number): Promise<any | null> {
    const [rows] = await connection.query(
        `SELECT * FROM tblOrdenesCompra WHERE Notas LIKE ? AND Status != ${OC_STATUS_DELETED} ORDER BY IdOrdenCompra LIMIT 1`,
        [`${compraMarker(idCompra)}%`]
    );
    return (rows as any[])[0] || null;
}

export type CompraOrderRef = {
    idOrden: number;
    idSucursal: number;
    /** true si la orden ya afectó (o afectará en esta transacción) el inventario. */
    aplicada: boolean;
};

/**
 * Garantiza que la compra capturada tenga su orden de compra. Si no existe, la
 * crea YA APLICADA (Status 1 + FechaAplicacion) — el caller registra los
 * movimientos de los renglones. Si existe (p. ej. migrada como Fantasma), la
 * respeta y reporta si está aplicada. Devuelve null si la compra no existe.
 * Debe llamarse dentro de una transacción abierta.
 */
export async function ensureAppliedOrderForCompra(
    connection: Connection,
    idCompra: number
): Promise<CompraOrderRef | null> {
    // Serializa la creación por compra (dos renglones simultáneos de la misma
    // compra no deben crear dos órdenes).
    const [compraRows] = await connection.query(
        'SELECT * FROM tblCompras WHERE IdCompra = ? FOR UPDATE',
        [idCompra]
    );
    const compra = (compraRows as any[])[0];
    if (!compra) return null;

    const existing = await findOrderForCompra(connection, idCompra);
    if (existing) {
        return {
            idOrden: existing.IdOrdenCompra,
            idSucursal: existing.IdSucursal,
            aplicada: Boolean(existing.FechaAplicacion),
        };
    }

    const notasParts = [compraMarker(idCompra)];
    if (compra.NumeroFactura) notasParts.push(`Factura ${compra.NumeroFactura}`);
    if (compra.ConceptoCompra) notasParts.push(String(compra.ConceptoCompra).slice(0, 150));

    const [result] = await connection.query(
        `INSERT INTO tblOrdenesCompra
            (IdProveedor, IdSucursal, EsInterna, EsSalida, FechaOrden, FechaEntrega, FechaProgramadaEntrega,
             Status, Notas, FechaAplicacion, FechaAct)
         VALUES (?, ?, 0, 0, ?, NULL, NULL, ?, ?, Now(), Now())`,
        [compra.IdProveedor || 0, compra.IdSucursal, compra.FechaCompra || new Date(), OC_STATUS_APPLIED, notasParts.join(' — ')]
    );

    return {
        idOrden: (result as ResultSetHeader).insertId,
        idSucursal: compra.IdSucursal,
        aplicada: true,
    };
}

/**
 * Sincroniza los renglones de la orden con los renglones vigentes de la compra
 * capturada (espejo: borra y re-inserta). No toca el kardex — los movimientos
 * los registra el caller con deltas.
 */
export async function syncOrderDetailsFromCompra(connection: Connection, idOrden: number, idCompra: number) {
    await connection.query('DELETE FROM tblOrdenesCompraDetalle WHERE IdOrdenCompra = ?', [idOrden]);
    await connection.query(
        `INSERT INTO tblOrdenesCompraDetalle (IdOrdenCompra, IdProducto, Cantidad, PrecioUnitario, Total, FechaAct)
         SELECT ?, d.IdProducto, d.Cantidad, d.Costo, d.Cantidad * d.Costo, Now()
         FROM tblDetalleCompras d
         WHERE d.IdCompra = ? AND (d.Status IS NULL OR d.Status <> 2)
           AND d.IdProducto IS NOT NULL AND d.Cantidad > 0`,
        [idOrden, idCompra]
    );
}
