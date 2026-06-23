import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

/** 'YYYY-MM-DD' de hoy en zona horaria de México. */
function todayMX(): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
}

const TABLE = 'tblWansoftVentasSucursal';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || todayMX();

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT Fecha, IdSucursal, Sucursal,
                    VentasBrutasTotal, Cortesias, Descuentos, Promociones,
                    Cancelaciones, Anulaciones, VentasNetasTotal, CapturadoEn
             FROM \`${TABLE}\`
             WHERE Fecha = ?
             ORDER BY VentasNetasTotal DESC, Sucursal ASC`,
            [date]
        );

        // Fechas disponibles para el selector
        const [dateRows] = await pool.query<RowDataPacket[]>(
            `SELECT DISTINCT Fecha FROM \`${TABLE}\` ORDER BY Fecha DESC LIMIT 90`
        );

        const totalNetas = rows.reduce((s, r) => s + Number(r.VentasNetasTotal || 0), 0);
        const totalBrutas = rows.reduce((s, r) => s + Number(r.VentasBrutasTotal || 0), 0);
        const lastCapture = rows.reduce<string | null>((max, r) => {
            const c = r.CapturadoEn ? new Date(r.CapturadoEn).toISOString() : null;
            return c && (!max || c > max) ? c : max;
        }, null);

        return NextResponse.json({
            success: true,
            date,
            rows,
            totalNetas,
            totalBrutas,
            lastCapture,
            availableDates: dateRows.map((d) => {
                const f = new Date(d.Fecha);
                return new Intl.DateTimeFormat('en-CA').format(f);
            }),
        });
    } catch (error: unknown) {
        // Si la tabla aún no existe (scraper no ha corrido), devolver vacío en vez de 500.
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist") || msg.includes('ER_NO_SUCH_TABLE')) {
            return NextResponse.json({ success: true, date: todayMX(), rows: [], totalNetas: 0, totalBrutas: 0, lastCapture: null, availableDates: [] });
        }
        console.error('Error fetching Wansoft sales by branch:', error);
        return NextResponse.json({ success: false, message: 'Error al obtener ventas por sucursal' }, { status: 500 });
    }
}
