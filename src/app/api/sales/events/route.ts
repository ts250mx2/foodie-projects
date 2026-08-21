import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

export const runtime = 'nodejs';

/**
 * GET /api/sales/events?projectId
 * Eventos agendados con fecha, para el Calendario de Eventos.
 * Aparecen las cotizaciones CONFIRMADAS y las TERMINADAS: terminar un evento
 * no lo borra de la agenda, siguió ocurriendo ese día y su recaudación real es
 * justo lo que se quiere consultar después. Solo activas (Status = 0).
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
                    CantidadPlatillos, Recaudacion, IngresoEstimado, CostoTotal, UtilidadEstimada, UtilidadReal,
                    EstatusEvento, Contacto, DireccionEvento, Notas
             FROM tblCotizaciones
             WHERE Status = 0 AND EstatusEvento IN ('confirmada', 'terminada') AND FechaEvento IS NOT NULL
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
