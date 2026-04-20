import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { Connection, RowDataPacket } from 'mysql2/promise';

const PRODUCT_OCR_PROMPT = (categories: string[]) => `
Analyze these document images (they could be invoices, product lists, receipts, etc.). 
Extract a detailed list of products with the following fields:
- description (The full name of the product as it appears in the document)
- CodigoBarras (The barcode or SKU if available, otherwise null)
- price (The unit price or cost)
- purchaseUnit (The unit of measure of the document row, e.g., 'CAJA', 'DOCENA', 'PZA'. MUST be one of these: KG, G, LB, OZ, T, AR, L, ML, GAL, QT, PT, FL-OZ, TAZA, CAJA, SACO, DOCENA, PAQUETE, BOLSA, PZA, LATA, BOTELLA, FRASCO, GARRAFON).
- cantidadCompra (EXTRACT the purchase quantity/weight/content ONLY from the text in the description, e.g., 'Jamón 5 KG' -> 5, 'Box 24 units' -> 24. If no quantity is mentioned in the description, default to 1).
- category (Choose the most appropriate category from the following list: [${categories.join(', ')}]. If none match accurately, pick the closest logical one).

IMPORTANT: Ignore any 'quantity' field from the document's line items. Only use the description to find the purchase quantity.

Return ONLY a JSON object with this structure: 
{
  "products": [
    {
      "description": "HARINA DE TRIGO 5 KG", 
      "CodigoBarras": "SKU123", 
      "price": 25.00, 
      "purchaseUnit": "SACO",
      "cantidadCompra": 5.0,
      "category": "🍎 Frutas"
    }
  ]
}
Ensure numeric values are numbers, not strings. IMPORTANT: Close the JSON object correctly.
`;

async function processWithClaude(files: File[], prompt: string, modelName: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured in .env');

    const imageContents = await Promise.all(
        files.map(async (file) => {
            const bytes = await file.arrayBuffer();
            const base64Image = Buffer.from(bytes).toString('base64');
            return {
                type: 'image' as const,
                source: {
                    type: 'base64' as const,
                    media_type: file.type || 'image/jpeg',
                    data: base64Image
                }
            };
        })
    );

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: modelName,
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: [
                    ...imageContents,
                    { type: 'text', text: prompt }
                ]
            }]
        })
    });

    if (!response.ok) {
        const err = await response.json();
        console.error('Claude API Error:', err);
        throw new Error('Error processing images with Claude');
    }

    const data = await response.json();
    return data.content[0].text;
}

async function processWithGPT4o(files: File[], prompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured in .env');

    const imageContents = await Promise.all(
        files.map(async (file) => {
            const bytes = await file.arrayBuffer();
            const base64Image = Buffer.from(bytes).toString('base64');
            const mimeType = file.type || 'image/jpeg';
            return {
                type: 'image_url' as const,
                image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                    detail: 'high'
                }
            };
        })
    );

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: [
                    ...imageContents,
                    { type: 'text', text: prompt }
                ]
            }]
        })
    });

    if (!response.ok) {
        const err = await response.json();
        console.error('GPT-4o API Error:', err);
        throw new Error('Error processing images with GPT-4o');
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

export async function POST(request: NextRequest) {
    let connection: Connection | null = null;
    try {
        const formData = await request.formData();
        const files = formData.getAll('image') as File[];
        const model = (formData.get('model') as string) || 'claude-3-5-sonnet-20241022';
        const projectIdStr = formData.get('projectId') as string;

        if (!files || files.length === 0) {
            return NextResponse.json({ success: false, message: 'No images provided' }, { status: 400 });
        }
        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Missing projectId' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // 1. Fetch categories for the prompt
        const [categoryRows] = await connection.query<RowDataPacket[]>(
            'SELECT IdCategoria, Categoria, ImagenCategoria FROM BDFoodieProjects.tblCategorias WHERE Status = 0'
        );
        const categories = categoryRows.map(c => `${c.ImagenCategoria || ''} ${c.Categoria}`.trim());

        // 2. Process with AI
        const prompt = PRODUCT_OCR_PROMPT(categories);
        let content: string;
        if (model === 'gpt-4o') {
            content = await processWithGPT4o(files, prompt);
        } else {
            content = await processWithClaude(files, prompt, model);
        }

        // 3. Parse JSON result
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        let ocrResult = null;
        if (jsonMatch) {
            try {
                ocrResult = JSON.parse(jsonMatch[0]);
            } catch (pErr) {
                console.error('JSON Parse Error:', pErr, 'Content:', content);
                throw new Error('Malformed JSON response from AI');
            }
        }

        if (!ocrResult || !ocrResult.products) {
            return NextResponse.json({ success: false, message: 'Could not parse OCR result' }, { status: 500 });
        }

        // 4. Cross-reference with tblRelacionProductosOCR and Map Categories
        const processedProducts = [];
        for (const product of ocrResult.products) {
            const [relRows] = await connection.query<RowDataPacket[]>(
                'SELECT IdProducto FROM tblRelacionProductosOCR WHERE ProductoOCR = ? AND Status = 0',
                [product.description]
            );

            // Find matching category ID
            const matchedCat = categoryRows.find(c => {
                const fullStr = `${c.ImagenCategoria || ''} ${c.Categoria}`.trim().toLowerCase();
                const aiCat = (product.category || '').trim().toLowerCase();
                return fullStr === aiCat || c.Categoria.trim().toLowerCase() === aiCat;
            });

            const baseProduct = {
                ...product,
                IdCategoria: matchedCat?.IdCategoria || null
            };

            if (relRows.length > 0) {
                processedProducts.push({
                    ...baseProduct,
                    systemId: relRows[0].IdProducto,
                    isLinked: true
                });
            } else {
                processedProducts.push({
                    ...baseProduct,
                    systemId: null,
                    isLinked: false
                });
            }
        }

        return NextResponse.json({
            success: true,
            data: { products: processedProducts },
            model
        });

    } catch (error: any) {
        console.error('Error in product OCR processing:', error);
        return NextResponse.json({ success: false, message: error.message || 'Internal server error' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
