import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import {
    computeQuoteTotals,
    normalizeGastos,
    normalizeDishes,
    parseQuoteStatus,
    resolveQuoteStatus,
} from '@/lib/quotes';

export const runtime = 'nodejs';

// GET: una cotización con su desglose de gastos.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let connection;
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));
        const [rows]: any = await connection.query('SELECT * FROM tblCotizaciones WHERE IdCotizacion = ?', [id]);
        if (!rows.length) {
            return NextResponse.json({ success: false, message: 'Cotización no encontrada' }, { status: 404 });
        }
        const [gastos] = await connection.query(
            'SELECT IdCotizacionGasto, Concepto, Monto FROM tblCotizacionesGastos WHERE IdCotizacion = ? ORDER BY IdCotizacionGasto',
            [id]
        );
        const [platillos] = await connection.query(
            'SELECT IdCotizacionPlatillo, IdPlatillo, Platillo, Tipo, Unidad, Cantidad, CostoUnitario, PrecioUnitario FROM tblCotizacionesPlatillos WHERE IdCotizacion = ? ORDER BY IdCotizacionPlatillo',
            [id]
        );
        return NextResponse.json({ success: true, data: { ...rows[0], gastos, platillos } });
    } catch (error) {
        console.error('Error fetching quote:', error);
        return NextResponse.json({ success: false, message: 'Error fetching quote' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

// PUT: actualiza la cotización y reemplaza su desglose de gastos y platillos.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const {
            projectId, nombreEvento, fechaEvento, horaEvento, estatus, recaudacion, notas,
            contacto, direccionEvento, gastos = [], platillos = [],
        } = body;

        if (!projectId || !nombreEvento) {
            return NextResponse.json({ success: false, message: 'Faltan campos obligatorios (proyecto y nombre del evento).' }, { status: 400 });
        }

        const items = normalizeGastos(gastos);
        const dishes = normalizeDishes(platillos);

        connection = await getProjectConnection(parseInt(projectId));

        // El estatus se resuelve contra el que YA tiene en base: el cliente no
        // puede saltarse el ciclo (a Terminada solo se llega desde Confirmada).
        const [currentRows]: any = await connection.query(
            'SELECT EstatusEvento, Recaudacion FROM tblCotizaciones WHERE IdCotizacion = ?',
            [id]
        );
        if (!currentRows.length) {
            return NextResponse.json({ success: false, message: 'Cotización no encontrada' }, { status: 404 });
        }

        const estatusEvento = resolveQuoteStatus(currentRows[0].EstatusEvento, estatus);
        // La recaudación real solo existe en eventos terminados; mientras no lo
        // estén se guarda en cero para que la utilidad real no engañe.
        const recaudacionReal = estatusEvento === 'terminada'
            ? (Number(recaudacion) || Number(currentRows[0].Recaudacion) || 0)
            : 0;
        const t = computeQuoteTotals({ platillos: dishes, recaudacion: recaudacionReal, gastos: items });

        await connection.query(
            `UPDATE tblCotizaciones SET
              NombreEvento = ?, FechaEvento = ?, HoraEvento = ?, EstatusEvento = ?, CantidadPlatillos = ?, GastosOperativos = ?, Recaudacion = ?,
              CostoPlatillos = ?, IngresoEstimado = ?, CostoTotal = ?, UtilidadEstimada = ?, UtilidadReal = ?,
              Contacto = ?, DireccionEvento = ?, Notas = ?, FechaAct = Now()
             WHERE IdCotizacion = ?`,
            [
                nombreEvento, fechaEvento || null, horaEvento || null, estatusEvento, t.cantidadPlatillos,
                t.gastosOperativos, recaudacionReal, t.costoPlatillos,
                t.ingresoEstimado, t.costoTotal, t.utilidadEstimada, t.utilidadReal,
                contacto || null, direccionEvento || null, notas || null, id,
            ]
        );

        // Reemplaza las líneas de platillo y el desglose de gastos.
        await connection.query('DELETE FROM tblCotizacionesPlatillos WHERE IdCotizacion = ?', [id]);
        for (const d of dishes) {
            await connection.query(
                `INSERT INTO tblCotizacionesPlatillos (IdCotizacion, IdPlatillo, Platillo, Tipo, Unidad, Cantidad, CostoUnitario, PrecioUnitario, FechaAct)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, Now())`,
                [id, d.idPlatillo, d.platillo, d.tipo, d.unidad || null, d.cantidad, d.costoUnitario, d.precioUnitario]
            );
        }
        await connection.query('DELETE FROM tblCotizacionesGastos WHERE IdCotizacion = ?', [id]);
        for (const g of items) {
            await connection.query(
                `INSERT INTO tblCotizacionesGastos (IdCotizacion, Concepto, Monto, FechaAct) VALUES (?, ?, ?, Now())`,
                [id, g.concepto, g.monto]
            );
        }

        return NextResponse.json({ success: true, message: 'Cotización actualizada correctamente', estatus: estatusEvento });
    } catch (error) {
        console.error('Error updating quote:', error);
        return NextResponse.json({ success: false, message: 'Error updating quote' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

/**
 * PATCH: cambia sólo el estatus del evento sin tocar el resto.
 * Terminada exige la recaudación real: es el dato que convierte la utilidad
 * estimada en utilidad real, y se recalcula contra el costo ya guardado.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, estatus, recaudacion } = body;
        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        const [rows]: any = await connection.query(
            'SELECT EstatusEvento, CostoTotal FROM tblCotizaciones WHERE IdCotizacion = ?',
            [id]
        );
        if (!rows.length) {
            return NextResponse.json({ success: false, message: 'Cotización no encontrada' }, { status: 404 });
        }

        const actual = parseQuoteStatus(rows[0].EstatusEvento);
        const pedido = parseQuoteStatus(estatus);
        const estatusEvento = resolveQuoteStatus(actual, pedido);
        if (estatusEvento !== pedido) {
            return NextResponse.json(
                { success: false, message: `No se puede pasar de ${actual} a ${pedido}`, estatus: actual },
                { status: 409 }
            );
        }

        if (estatusEvento === 'terminada') {
            const recaudacionReal = Number(recaudacion);
            if (!Number.isFinite(recaudacionReal) || recaudacionReal < 0) {
                return NextResponse.json(
                    { success: false, message: 'Captura la recaudación real del evento para terminarlo' },
                    { status: 400 }
                );
            }
            const costoTotal = Number(rows[0].CostoTotal) || 0;
            const utilidadReal = recaudacionReal - costoTotal;
            await connection.query(
                `UPDATE tblCotizaciones
                    SET EstatusEvento = ?, Recaudacion = ?, UtilidadReal = ?, FechaAct = Now()
                  WHERE IdCotizacion = ?`,
                [estatusEvento, recaudacionReal, utilidadReal, id]
            );
            return NextResponse.json({
                success: true,
                message: 'Evento terminado',
                estatus: estatusEvento,
                recaudacion: recaudacionReal,
                utilidadReal,
            });
        }

        await connection.query(
            'UPDATE tblCotizaciones SET EstatusEvento = ?, FechaAct = Now() WHERE IdCotizacion = ?',
            [estatusEvento, id]
        );
        return NextResponse.json({ success: true, message: 'Estatus actualizado', estatus: estatusEvento });
    } catch (error) {
        console.error('Error updating quote status:', error);
        return NextResponse.json({ success: false, message: 'Error updating quote status' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

// DELETE: borrado lógico (Status = 2).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let connection;
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));
        await connection.query('UPDATE tblCotizaciones SET Status = 2, FechaAct = Now() WHERE IdCotizacion = ?', [id]);
        return NextResponse.json({ success: true, message: 'Cotización eliminada correctamente' });
    } catch (error) {
        console.error('Error deleting quote:', error);
        return NextResponse.json({ success: false, message: 'Error deleting quote' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
