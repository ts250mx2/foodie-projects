import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { completarTexto, credencialParaRuta } from '@/lib/ai/agente-modelo';

const OCR_PROMPT = 'Analyze these receipt images. Extract the provider name, the total amount, the ticket/receipt number (if available), the date of the receipt (YYYY-MM-DD), and a detailed list of concepts/items with their quantity and price. For each concept, also try to extract any product code or SKU if visible. Return ONLY a JSON object with this structure: {"provider": "NAME", "total": 0.00, "ticketNumber": "12345", "date": "2024-03-19", "concepts": [{"description": "Item Name", "code": "SKU123", "quantity": 1, "price": 0.00, "total": 0.00}]}. Ensure numeric values are numbers, not strings. IMPORTANT: Close the JSON object correctly, do not leave it truncated.';

/**
 * Lee los tickets con el agente de HL Console (proyecto hl-servidor): el
 * proveedor, el modelo y la llave los pone HL, aquí no se elige ninguno.
 */
async function processWithHl(files: File[]): Promise<{ content: string; model: string }> {
    const credencialHl = await credencialParaRuta('foodie');
    if (!credencialHl.ok) throw new Error(credencialHl.error);

    const imageContents = await Promise.all(
        files.map(async (file): Promise<Anthropic.ContentBlockParam> => {
            const bytes = await file.arrayBuffer();
            const base64Image = Buffer.from(bytes).toString('base64');

            if (file.type === 'application/pdf') {
                return {
                    type: 'document',
                    source: { type: 'base64', media_type: 'application/pdf', data: base64Image },
                };
            }

            return {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: (file.type || 'image/jpeg') as 'image/jpeg',
                    data: base64Image,
                },
            };
        })
    );

    const { texto, modelo } = await completarTexto(credencialHl.credencial, {
        maxTokens: 4096,
        mensajes: [{ role: 'user', content: [...imageContents, { type: 'text', text: OCR_PROMPT }] }],
    });
    return { content: texto, model: modelo };
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('image') as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ success: false, message: 'No images provided' }, { status: 400 });
        }

        const { content, model } = await processWithHl(files);

        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        let result = null;
        if (jsonMatch) {
            try {
                result = JSON.parse(jsonMatch[0]);
            } catch (pErr) {
                console.error('JSON Parse Error:', pErr, 'Content:', content);
                throw new Error('Malformed JSON response from AI');
            }
        }

        if (!result) {
            return NextResponse.json({ success: false, message: 'Could not parse OCR result' }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: result, model });
    } catch (error) {
        console.error('Error in process-receipt route:', error);
        return NextResponse.json({ success: false, message: (error as Error).message || 'Internal server error' }, { status: 500 });
    }
}
