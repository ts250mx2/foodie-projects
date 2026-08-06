import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import { getProjectConnection } from '@/lib/dynamic-db';
import { OC_STATUS_DELETED, OC_STATUS_DISCARDED } from '@/lib/warehouse';

/**
 * Bandeja de requisiciones del portal (campana del Header).
 *
 * Devuelve un historial, no solo lo nuevo: las no leídas siempre aparecen y
 * además se conservan las leídas de los últimos días, para poder volver a una
 * requisición ya atendida. `count` cuenta únicamente las NO leídas — es lo que
 * enciende el badge y mantiene sonando la alarma.
 */
const IGNORED_STATUSES = [OC_STATUS_DELETED, OC_STATUS_DISCARDED];

/** Días que se conservan en la bandeja las requisiciones ya leídas. */
const HISTORY_DAYS = 7;

/** Tope de renglones devueltos. */
const MAX_ROWS = 20;

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        const [rows] = await connection.query(
            `SELECT
                oc.IdOrdenCompra,
                oc.FechaOrden,
                oc.FechaRequisicionVista,
                oc.RequisicionSolicitante,
                oc.RequisicionArea,
                s.Sucursal,
                (SELECT COUNT(*) FROM tblOrdenesCompraDetalle d
                  WHERE d.IdOrdenCompra = oc.IdOrdenCompra) AS Renglones,
                (SELECT SUM(d.Cantidad) FROM tblOrdenesCompraDetalle d
                  WHERE d.IdOrdenCompra = oc.IdOrdenCompra) AS Unidades,
                -- Resumen de lo pedido, para poder triar sin abrir la orden.
                (SELECT GROUP_CONCAT(p.Producto ORDER BY d.IdOrdenCompraDetalle SEPARATOR ' · ')
                   FROM tblOrdenesCompraDetalle d
                   JOIN tblProductos p ON d.IdProducto = p.IdProducto
                  WHERE d.IdOrdenCompra = oc.IdOrdenCompra) AS Resumen
             FROM tblOrdenesCompra oc
             LEFT JOIN tblSucursales s ON oc.IdSucursal = s.IdSucursal
             WHERE oc.EsRequisicion = 1
               AND oc.Status NOT IN (?, ?)
               AND (oc.FechaRequisicionVista IS NULL
                    OR oc.FechaOrden >= DATE_SUB(NOW(), INTERVAL ? DAY))
             ORDER BY oc.FechaOrden DESC
             LIMIT ${MAX_ROWS}`,
            [...IGNORED_STATUSES, HISTORY_DAYS]
        );

        const requisitions = rows as RowDataPacket[];
        const unread = requisitions.filter(r => !r.FechaRequisicionVista).length;

        return NextResponse.json({ success: true, count: unread, data: requisitions });
    } catch (error) {
        console.error('Error fetching requisitions:', error);
        return NextResponse.json({ success: false, message: 'Error fetching requisitions' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

/**
 * Marca requisiciones como leídas. Sin idOrdenCompra marca todas las
 * pendientes ("marcar todas"). Nunca borra: la requisición sigue en la bandeja.
 */
export async function PATCH(request: NextRequest) {
    let connection;
    try {
        const { projectId, idOrdenCompra } = await request.json();
        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        if (idOrdenCompra) {
            await connection.query(
                `UPDATE tblOrdenesCompra SET FechaRequisicionVista = Now()
                 WHERE IdOrdenCompra = ? AND EsRequisicion = 1 AND FechaRequisicionVista IS NULL`,
                [idOrdenCompra]
            );
        } else {
            await connection.query(
                `UPDATE tblOrdenesCompra SET FechaRequisicionVista = Now()
                 WHERE EsRequisicion = 1 AND FechaRequisicionVista IS NULL`
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error marking requisitions as read:', error);
        return NextResponse.json({ success: false, message: 'Error updating requisitions' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
