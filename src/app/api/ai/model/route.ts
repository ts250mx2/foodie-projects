import { NextResponse } from 'next/server';
import { obtenerAgente, agenteConfigurado } from '@/lib/hl-cliente';

export const runtime = 'nodejs';

/**
 * Qué modelo de IA está atendiendo, según HL Console.
 *
 * El modelo NO vive en el código ni en el .env de Foodie: se administra en el
 * portal de HL, que además sustituye el campo `model` de cada llamada. Esta
 * ruta es la única forma de que la pantalla diga la verdad — leer una constante
 * local mentiría en cuanto alguien cambie el agente en el portal.
 *
 * `obtenerAgente` ya cachea en memoria durante HL_TTL_MIN, así que esto no
 * golpea a HL en cada carga del chat.
 */
export async function GET() {
    try {
        if (!agenteConfigurado('foodie')) {
            return NextResponse.json({ success: false, message: 'El agente de HL no está configurado' }, { status: 503 });
        }

        const agente = await obtenerAgente('foodie');

        return NextResponse.json({
            success: true,
            modelo: agente.modelo,
            proveedor: agente.proveedor,
            respaldo: agenteConfigurado('respaldo'),
        });
    } catch (error) {
        console.error('Error consultando el modelo de IA:', error);
        // No es un fallo que deba alarmar: el chat funciona igual aunque no se
        // pueda anunciar el modelo.
        return NextResponse.json({ success: false, message: 'No se pudo consultar el modelo' }, { status: 502 });
    }
}
