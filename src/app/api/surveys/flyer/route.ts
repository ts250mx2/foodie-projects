import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';
import { resolveSurveyUuid } from '@/lib/surveys';

/**
 * Flyer de promoción de la encuesta, servido como imagen binaria.
 *
 * ENDPOINT SIN AUTENTICACIÓN: la única credencial es el UUID de la liga (el
 * mismo QR de la pantalla de gracias lo trae). Solo entrega la imagen del
 * flyer: nada más de la configuración sale por aquí.
 */
export async function GET(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const uuid = searchParams.get('uuid') || '';

        const project = await resolveSurveyUuid(uuid);
        if (!project) {
            // Mismo mensaje para UUID mal formado, inexistente, revocado o
            // módulo apagado.
            return NextResponse.json({ success: false, message: 'Liga no válida' }, { status: 404 });
        }

        connection = await getProjectConnection(project.idProyecto);

        const [rows] = await connection.query<RowDataPacket[]>(
            'SELECT FlyerImagen FROM tblEncuestasConfig ORDER BY IdConfig ASC LIMIT 1'
        );
        const flyer = rows[0]?.FlyerImagen;

        const match = typeof flyer === 'string'
            ? /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(flyer)
            : null;
        if (!match) {
            return NextResponse.json({ success: false, message: 'Promoción no disponible' }, { status: 404 });
        }

        return new NextResponse(Buffer.from(match[2], 'base64'), {
            headers: {
                'Content-Type': match[1],
                // El flyer cambia poco; 5 min de caché evita redescargarlo en
                // cada escaneo sin dejar viejo un flyer recién reemplazado.
                'Cache-Control': 'private, max-age=300',
            },
        });
    } catch (error) {
        console.error('Error serving survey flyer:', error);
        return NextResponse.json({ success: false, message: 'Error al cargar la promoción' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
