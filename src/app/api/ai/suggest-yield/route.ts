import { NextResponse } from 'next/server';
import { completarTexto, credencialParaRuta } from '@/lib/ai/agente-modelo';
import { extraerJson } from '@/lib/ai/json-respuesta';

// Proveedor y modelo los fija HL Console (agente HL_AGENTE_FOODIE).
export async function POST(req: Request) {
    try {
        const { productName } = await req.json();

        if (!productName) {
            return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
        }

        const credencialHl = await credencialParaRuta('foodie');
        if (!credencialHl.ok) {
            return NextResponse.json({ error: credencialHl.error }, { status: 503 });
        }

        const { texto } = await completarTexto(credencialHl.credencial, {
            maxTokens: 1500,
            sistema: "Eres un experto en costos culinarios y auditoría de alimentos. Tu tarea es sugerir el porcentaje de rendimiento (yield) estándar de la industria para un producto específico, considerando diferentes procesos culinarios. Responde ÚNICAMENTE con el objeto JSON que se te pide, sin texto alrededor ni bloques de código.",
            mensajes: [
                {
                    role: "user",
                    content: `Sugiere el rendimiento (porcentaje utilizable después de limpieza/proceso) para el producto: "${productName}". 
                    Identifica diferentes estados o procesos por los que puede pasar el producto (ej. Limpieza inicial/Crudo, Cocido, Frito, etc.) y ofrece el rendimiento para cada uno.
                    Devuelve un objeto JSON con el campo:
                    - suggestions: (array de objetos con campos:
                        - process: (string, ej. 'Crudo / Limpieza', 'Cocido (Hervido)', 'Frito')
                        - yield: (número de 1 a 200, usualmente menor a 100 pero puede ser mayor si absorbe agua)
                        - explanation: (string breve en español explicando el porqué de ese rendimiento)
                    )`
                }
            ],
        });

        return NextResponse.json(extraerJson(texto));

    } catch (error: any) {
        console.error('AI Suggest Yield Error:', error);
        return NextResponse.json({
            error: 'Error al obtener sugerencia de la IA',
            details: error.message
        }, { status: 500 });
    }
}
