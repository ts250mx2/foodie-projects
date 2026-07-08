import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { computeQuoteTotals, normalizeGastos, normalizeDishes } from '@/lib/quotes';

export const runtime = 'nodejs';

// GET: lista de cotizaciones del proyecto.
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
            `SELECT * FROM tblCotizaciones WHERE Status = 0 ORDER BY FechaEvento DESC, IdCotizacion DESC`
        );
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching quotes:', error);
        return NextResponse.json({ success: false, message: 'Error fetching quotes' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

// POST: crea una cotización (con su desglose de gastos operativos).
export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, nombreEvento, fechaEvento, horaEvento, estatus, recaudacion, notas, gastos = [], platillos = [] } = body;

        if (!projectId || !nombreEvento) {
            return NextResponse.json({ success: false, message: 'Faltan campos obligatorios (proyecto y nombre del evento).' }, { status: 400 });
        }

        const items = normalizeGastos(gastos);
        const dishes = normalizeDishes(platillos);
        const t = computeQuoteTotals({ platillos: dishes, recaudacion, gastos: items });
        const estatusEvento = estatus === 'confirmada' ? 'confirmada' : 'pendiente';

        connection = await getProjectConnection(parseInt(projectId));

        const [result]: any = await connection.query(
            `INSERT INTO tblCotizaciones
              (NombreEvento, FechaEvento, HoraEvento, EstatusEvento, CantidadPlatillos, GastosOperativos, Recaudacion,
               CostoPlatillos, IngresoEstimado, CostoTotal, UtilidadEstimada, UtilidadReal,
               Notas, Status, FechaAct)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, Now())`,
            [
                nombreEvento, fechaEvento || null, horaEvento || null, estatusEvento, t.cantidadPlatillos,
                t.gastosOperativos, Number(recaudacion) || 0, t.costoPlatillos,
                t.ingresoEstimado, t.costoTotal, t.utilidadEstimada, t.utilidadReal,
                notas || null,
            ]
        );

        const idCotizacion = result.insertId;
        for (const d of dishes) {
            await connection.query(
                `INSERT INTO tblCotizacionesPlatillos (IdCotizacion, IdPlatillo, Platillo, Tipo, Unidad, Cantidad, CostoUnitario, PrecioUnitario, FechaAct)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, Now())`,
                [idCotizacion, d.idPlatillo, d.platillo, d.tipo, d.unidad || null, d.cantidad, d.costoUnitario, d.precioUnitario]
            );
        }
        for (const g of items) {
            await connection.query(
                `INSERT INTO tblCotizacionesGastos (IdCotizacion, Concepto, Monto, FechaAct) VALUES (?, ?, ?, Now())`,
                [idCotizacion, g.concepto, g.monto]
            );
        }

        return NextResponse.json({ success: true, message: 'Cotización creada correctamente', id: idCotizacion });
    } catch (error) {
        console.error('Error creating quote:', error);
        return NextResponse.json({ success: false, message: 'Error creating quote' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
