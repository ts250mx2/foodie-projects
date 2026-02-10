import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    try {
        const { productName } = await req.json();

        if (!productName) {
            return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY is not configured');
            return NextResponse.json({
                error: 'AI service not configured',
                suggestion: 'Please add OPENAI_API_KEY to your .env.local file'
            }, { status: 500 });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Eres un experto en costos culinarios y auditoría de alimentos. Tu tarea es sugerir el porcentaje de rendimiento (yield) estándar de la industria para un producto específico, considerando diferentes procesos culinarios."
                },
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
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        if (!content) {
            throw new Error('No content returned from AI');
        }

        const result = JSON.parse(content);
        return NextResponse.json(result);

    } catch (error: any) {
        console.error('AI Suggest Yield Error:', error);
        return NextResponse.json({
            error: 'Error al obtener sugerencia de la IA',
            details: error.message
        }, { status: 500 });
    }
}
