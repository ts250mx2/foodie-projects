import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { computeQuoteTotals, normalizeGastos, normalizeDishes } from '@/lib/quotes';

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
            'SELECT IdCotizacionPlatillo, IdPlatillo, Platillo, Cantidad, CostoUnitario, PrecioUnitario FROM tblCotizacionesPlatillos WHERE IdCotizacion = ? ORDER BY IdCotizacionPlatillo',
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

// PUT: actualiza la cotización y reemplaza su desglose de gastos.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, nombreEvento, fechaEvento, recaudacion, notas, gastos = [], platillos = [] } = body;

        if (!projectId || !nombreEvento) {
            return NextResponse.json({ success: false, message: 'Faltan campos obligatorios (proyecto y nombre del evento).' }, { status: 400 });
        }

        const items = normalizeGastos(gastos);
        const dishes = normalizeDishes(platillos);
        const t = computeQuoteTotals({ platillos: dishes, recaudacion, gastos: items });

        connection = await getProjectConnection(parseInt(projectId));

        await connection.query(
            `UPDATE tblCotizaciones SET
              NombreEvento = ?, FechaEvento = ?, CantidadPlatillos = ?, GastosOperativos = ?, Recaudacion = ?,
              CostoPlatillos = ?, IngresoEstimado = ?, CostoTotal = ?, UtilidadEstimada = ?, UtilidadReal = ?,
              Notas = ?, FechaAct = Now()
             WHERE IdCotizacion = ?`,
            [
                nombreEvento, fechaEvento || null, t.cantidadPlatillos,
                t.gastosOperativos, Number(recaudacion) || 0, t.costoPlatillos,
                t.ingresoEstimado, t.costoTotal, t.utilidadEstimada, t.utilidadReal,
                notas || null, id,
            ]
        );

        // Reemplaza las líneas de platillo y el desglose de gastos.
        await connection.query('DELETE FROM tblCotizacionesPlatillos WHERE IdCotizacion = ?', [id]);
        for (const d of dishes) {
            await connection.query(
                `INSERT INTO tblCotizacionesPlatillos (IdCotizacion, IdPlatillo, Platillo, Cantidad, CostoUnitario, PrecioUnitario, FechaAct)
                 VALUES (?, ?, ?, ?, ?, ?, Now())`,
                [id, d.idPlatillo, d.platillo, d.cantidad, d.costoUnitario, d.precioUnitario]
            );
        }
        await connection.query('DELETE FROM tblCotizacionesGastos WHERE IdCotizacion = ?', [id]);
        for (const g of items) {
            await connection.query(
                `INSERT INTO tblCotizacionesGastos (IdCotizacion, Concepto, Monto, FechaAct) VALUES (?, ?, ?, Now())`,
                [id, g.concepto, g.monto]
            );
        }

        return NextResponse.json({ success: true, message: 'Cotización actualizada correctamente' });
    } catch (error) {
        console.error('Error updating quote:', error);
        return NextResponse.json({ success: false, message: 'Error updating quote' }, { status: 500 });
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
