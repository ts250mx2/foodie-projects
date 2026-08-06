import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import { getProjectConnection } from '@/lib/dynamic-db';
import { OC_STATUS_DELETED, OC_STATUS_DISCARDED } from '@/lib/warehouse';

/**
 * Requisiciones nuevas para el portal: las que nadie ha abierto todavía
 * (FechaRequisicionVista NULL) y siguen vivas. Es lo que alimenta la campana
 * del Header.
 */
const IGNORED_STATUSES = [OC_STATUS_DELETED, OC_STATUS_DISCARDED];

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
                oc.RequisicionSolicitante,
                oc.RequisicionArea,
                oc.Notas,
                s.Sucursal,
                (SELECT COUNT(*) FROM tblOrdenesCompraDetalle d WHERE d.IdOrdenCompra = oc.IdOrdenCompra) AS Renglones
             FROM tblOrdenesCompra oc
             LEFT JOIN tblSucursales s ON oc.IdSucursal = s.IdSucursal
             WHERE oc.EsRequisicion = 1
               AND oc.FechaRequisicionVista IS NULL
               AND oc.Status NOT IN (?, ?)
             ORDER BY oc.FechaOrden DESC
             LIMIT 25`,
            IGNORED_STATUSES
        );

        const requisitions = rows as RowDataPacket[];
        return NextResponse.json({ success: true, count: requisitions.length, data: requisitions });
    } catch (error) {
        console.error('Error fetching pending requisitions:', error);
        return NextResponse.json({ success: false, message: 'Error fetching requisitions' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

/**
 * Marca requisiciones como vistas. Sin idOrdenCompra marca todas las
 * pendientes ("marcar todas como vistas").
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
        console.error('Error marking requisitions as seen:', error);
        return NextResponse.json({ success: false, message: 'Error updating requisitions' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
