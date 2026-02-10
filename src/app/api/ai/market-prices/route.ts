import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
    try {
        const { productName } = await req.json();

        if (!productName) {
            return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
        }

        const serperApiKey = process.env.SERPER_API_KEY;
        if (!serperApiKey) {
            console.error('SERPER_API_KEY is not configured');
            return NextResponse.json({
                error: 'Search service not configured',
                suggestion: 'Please add SERPER_API_KEY to your .env.local file'
            }, { status: 500 });
        }

        const query = `precio de ${productName} por kilo o unidad mercado mexico`;

        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': serperApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: query,
                gl: 'mx',
                hl: 'es',
                num: 10
            })
        });

        const data = await response.json();

        // Extract relevant results
        const rawResults = (data.organic || []).map((item: any) => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet,
            source: item.source || (item.link ? new URL(item.link).hostname : 'Google')
        }));

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const extractionResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Eres un experto en análisis de mercados y precios. Tu tarea es extraer de forma estructurada los precios de productos a partir de fragmentos de búsqueda de Google."
                },
                {
                    role: "user",
                    content: `A partir de estos resultados de búsqueda para "${productName}", extrae el precio (si está presente), la unidad (kilo, pieza, bulto, etc.) y la fuente. 
                    Devuelve un objeto JSON con el campo:
                    - extractedResults: (array de objetos con campos:
                        - title: (string del titulo original)
                        - link: (string del link original)
                        - source: (string de la fuente original)
                        - price: (string del precio formateado con $, ej. '$250.00')
                        - unit: (string de la unidad, ej. 'kg', 'bulto 20kg', 'bolsa')
                        - snippet: (string del fragmento original)
                    )
                    Si no hay un precio claro, deja el campo price vacío.
                    
                    Resultados:
                    ${JSON.stringify(rawResults)}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const content = extractionResponse.choices[0].message.content;
        if (!content) {
            throw new Error('No content returned from AI for extraction');
        }

        const result = JSON.parse(content);
        return NextResponse.json({ results: result.extractedResults });

    } catch (error: any) {
        console.error('Market Prices Search Error:', error);
        return NextResponse.json({
            error: 'Error al buscar precios en el mercado',
            details: error.message
        }, { status: 500 });
    }
}
