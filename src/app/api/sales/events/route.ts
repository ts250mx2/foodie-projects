import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

export const runtime = 'nodejs';

/**
 * GET /api/sales/events?projectId
 * Eventos CONFIRMADOS con fecha, para el Calendario de Eventos.
 * Un evento aparece en el calendario sólo cuando su cotización está
 * confirmada (EstatusEvento = 'confirmada'), activa (Status = 0) y tiene fecha.
 */
export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required', data: [] }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));
        const [rows] = await connection.query(
            `SELECT IdCotizacion, NombreEvento, FechaEvento, HoraEvento,
                    CantidadPlatillos, Recaudacion, IngresoEstimado, CostoTotal, UtilidadEstimada, Notas
             FROM tblCotizaciones
             WHERE Status = 0 AND EstatusEvento = 'confirmada' AND FechaEvento IS NOT NULL
             ORDER BY FechaEvento ASC, HoraEvento ASC`
        );
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching events:', error);
        return NextResponse.json({ success: false, message: 'Error fetching events', data: [] }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
