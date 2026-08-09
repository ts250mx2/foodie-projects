import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';
import { applyOrderToWarehouse } from '@/lib/warehouse';
import {
    MAX_REQUISITION_STATUS_NOTE,
    REQ_STATUS_CREATED,
    REQ_STATUS_RELEASED,
    findRequisitionTransition,
    normalizeRequisitionStatus,
} from '@/lib/requisition-status';
import {
    MAX_SOLICITANTE_LEN,
    recordRequisitionStatusChange,
    sanitizeText,
} from '@/lib/requisitions';

/**
 * Ciclo de vida de una requisición: consulta del track y cambio de estado.
 *
 * GET  → cabecera + bitácora de estados (la línea de tiempo del modal).
 * POST → mueve la requisición a otro estado, validando la transición contra
 *        src/lib/requisition-status.ts. Solo la transición a "Salida de
 *        almacén" toca el inventario, y lo hace aquí: ya no se aplica sola al
 *        guardar la requisición.
 */

interface HistoryEvent {
    idEstatus: number | null;
    statusAnterior: number | null;
    statusNuevo: number;
    notas: string | null;
    usuario: string | null;
    fecha: string;
    /** Reconstruido de la orden porque es anterior a la bitácora. */
    sintetico: boolean;
}

/**
 * Una requisición vive en tblOrdenesCompra como orden interna o salida. Las
 * columnas no se prefijan: ninguna otra tabla del JOIN las tiene, y así el
 * mismo filtro sirve con y sin JOIN.
 */
const REQUISITION_FILTER = '(EsRequisicion = 1 OR EsInterna = 1 OR EsSalida = 1)';

/**
 * La variante con bloqueo no hace JOIN: serializa el renglón de la orden y
 * nada más, igual que el resto del módulo de almacén.
 */
async function loadOrder(connection: Connection, idOrdenCompra: number, forUpdate = false) {
    const [rows] = forUpdate
        ? await connection.query(
            `SELECT * FROM tblOrdenesCompra
             WHERE IdOrdenCompra = ? AND ${REQUISITION_FILTER}
             FOR UPDATE`,
            [idOrdenCompra]
        )
        : await connection.query(
            `SELECT oc.*, s.Sucursal
             FROM tblOrdenesCompra oc
             LEFT JOIN tblSucursales s ON oc.IdSucursal = s.IdSucursal
             WHERE oc.IdOrdenCompra = ? AND ${REQUISITION_FILTER}`,
            [idOrdenCompra]
        );
    return (rows as RowDataPacket[])[0] || null;
}

/**
 * Bitácora en orden cronológico. Las requisiciones anteriores a la bitácora no
 * tienen renglones, así que el alta se reconstruye desde FechaOrden y —si ya
 * estaba surtida— la salida desde FechaAplicacion. Sin esto la línea de tiempo
 * arrancaría vacía para todo lo viejo.
 */
async function loadHistory(connection: Connection, order: RowDataPacket): Promise<HistoryEvent[]> {
    const [rows] = await connection.query(
        `SELECT IdEstatus, StatusAnterior, StatusNuevo, Notas, Usuario, FechaCambio
         FROM tblOrdenesCompraEstatus
         WHERE IdOrdenCompra = ?
         ORDER BY FechaCambio ASC, IdEstatus ASC`,
        [order.IdOrdenCompra]
    );

    const events: HistoryEvent[] = (rows as RowDataPacket[]).map(row => ({
        idEstatus: row.IdEstatus,
        statusAnterior: row.StatusAnterior === null ? null : Number(row.StatusAnterior),
        statusNuevo: Number(row.StatusNuevo),
        notas: row.Notas || null,
        usuario: row.Usuario || null,
        fecha: new Date(row.FechaCambio).toISOString(),
        sintetico: false,
    }));

    const hasCreation = events.some(e => e.statusNuevo === REQ_STATUS_CREATED);
    if (!hasCreation && order.FechaOrden) {
        events.unshift({
            idEstatus: null,
            statusAnterior: null,
            statusNuevo: REQ_STATUS_CREATED,
            notas: null,
            usuario: order.RequisicionSolicitante || null,
            fecha: new Date(order.FechaOrden).toISOString(),
            sintetico: true,
        });
    }

    const hasRelease = events.some(e => e.statusNuevo === REQ_STATUS_RELEASED);
    if (!hasRelease && order.FechaAplicacion) {
        events.push({
            idEstatus: null,
            statusAnterior: null,
            statusNuevo: REQ_STATUS_RELEASED,
            notas: null,
            usuario: null,
            fecha: new Date(order.FechaAplicacion).toISOString(),
            sintetico: true,
        });
    }

    return events;
}

function serializeOrder(order: RowDataPacket) {
    return {
        idOrdenCompra: order.IdOrdenCompra,
        folio: `OC-${String(order.IdOrdenCompra).padStart(4, '0')}`,
        idSucursal: order.IdSucursal,
        sucursal: order.Sucursal || '',
        status: normalizeRequisitionStatus(order.Status),
        fechaOrden: order.FechaOrden ? new Date(order.FechaOrden).toISOString() : null,
        fechaAplicacion: order.FechaAplicacion ? new Date(order.FechaAplicacion).toISOString() : null,
        solicitante: order.RequisicionSolicitante || null,
        area: order.RequisicionArea || null,
        notas: order.Notas || null,
    };
}

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = Number(searchParams.get('projectId'));
        const idOrdenCompra = Number(searchParams.get('idOrdenCompra'));

        if (!Number.isInteger(projectId) || !Number.isInteger(idOrdenCompra)) {
            return NextResponse.json({ success: false, message: 'Parámetros incompletos' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        const order = await loadOrder(connection, idOrdenCompra);
        if (!order) {
            return NextResponse.json({ success: false, message: 'Requisición no encontrada' }, { status: 404 });
        }

        const history = await loadHistory(connection, order);
        return NextResponse.json({ success: true, data: { order: serializeOrder(order), history } });
    } catch (error) {
        console.error('Error fetching requisition status track:', error);
        return NextResponse.json({ success: false, message: 'Error al cargar el historial' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const projectId = Number(body?.projectId);
        const idOrdenCompra = Number(body?.idOrdenCompra);
        const status = Number(body?.status);

        if (!Number.isInteger(projectId) || !Number.isInteger(idOrdenCompra) || !Number.isInteger(status)) {
            return NextResponse.json({ success: false, message: 'Parámetros incompletos' }, { status: 400 });
        }

        const notas = sanitizeText(body?.notas, MAX_REQUISITION_STATUS_NOTE);
        const usuario = sanitizeText(body?.usuario, MAX_SOLICITANTE_LEN);

        connection = await getProjectConnection(projectId);
        await connection.beginTransaction();

        try {
            const order = await loadOrder(connection, idOrdenCompra, true);
            if (!order) {
                await connection.rollback();
                return NextResponse.json({ success: false, message: 'Requisición no encontrada' }, { status: 404 });
            }

            const current = normalizeRequisitionStatus(order.Status);
            const transition = findRequisitionTransition(current, status);
            if (!transition) {
                await connection.rollback();
                return NextResponse.json(
                    { success: false, message: 'Ese cambio de estado no está permitido desde el estado actual' },
                    { status: 409 }
                );
            }
            if (transition.requiresNote && !notas) {
                await connection.rollback();
                return NextResponse.json(
                    { success: false, message: 'La anotación es obligatoria para este cambio de estado' },
                    { status: 400 }
                );
            }

            if (transition.affectsWarehouse) {
                if (order.FechaAplicacion) {
                    await connection.rollback();
                    return NextResponse.json(
                        { success: false, message: 'La requisición ya descargó existencias del almacén' },
                        { status: 409 }
                    );
                }

                const [items] = await connection.query(
                    `SELECT ocd.*, p.UnidadMedidaCompra, p.UnidadMedidaInventario
                     FROM tblOrdenesCompraDetalle ocd
                     JOIN tblProductos p ON ocd.IdProducto = p.IdProducto
                     WHERE ocd.IdOrdenCompra = ?`,
                    [idOrdenCompra]
                );
                if ((items as RowDataPacket[]).length === 0) {
                    await connection.rollback();
                    return NextResponse.json({ success: false, message: 'La requisición no tiene productos' }, { status: 409 });
                }

                await applyOrderToWarehouse(connection, order, items as RowDataPacket[]);
                await connection.query(
                    'UPDATE tblOrdenesCompra SET Status = ?, FechaAplicacion = Now(), FechaAct = Now() WHERE IdOrdenCompra = ?',
                    [transition.to, idOrdenCompra]
                );
            } else {
                await connection.query(
                    'UPDATE tblOrdenesCompra SET Status = ?, FechaAct = Now() WHERE IdOrdenCompra = ?',
                    [transition.to, idOrdenCompra]
                );
            }

            await recordRequisitionStatusChange(connection, {
                idOrdenCompra,
                statusAnterior: current,
                statusNuevo: transition.to,
                notas,
                usuario,
            });

            await connection.commit();

            return NextResponse.json({
                success: true,
                status: transition.to,
                message: transition.affectsWarehouse
                    ? 'Salida de almacén aplicada — existencias restadas'
                    : `Requisición marcada como ${transition.label}`,
            });
        } catch (e) {
            await connection.rollback();
            throw e;
        }
    } catch (error) {
        console.error('Error changing requisition status:', error);
        return NextResponse.json({ success: false, message: 'Error al cambiar el estado' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
