import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { Connection, RowDataPacket } from 'mysql2/promise';

const PRODUCT_OCR_PROMPT = () => `
Analyze these document images (they could be invoices, product lists, receipts, etc.). 
Extract a list of products with exactly these fields:
- description: The full name of the product as it appears in the document.
- CodigoBarras: The barcode, SKU, or product code if available, otherwise null.
- cantidadCompra: Extract the purchase quantity/weight/content ONLY from the text in the description, e.g., 'Jamón 5 KG' -> 5, 'Box 24 units' -> 24. If no quantity is mentioned in the description, default to 1.

Return ONLY a JSON object with this structure: 
{
  "products": [
    {
      "description": "HARINA DE TRIGO 5 KG", 
      "CodigoBarras": "SKU123", 
      "cantidadCompra": 5.0
    }
  ]
}
Ensure numeric values are numbers, not strings.
`;

function getSimilarity(s1: string, s2: string): number {
    s1 = s1.toLowerCase().trim();
    s2 = s2.toLowerCase().trim();
    if (s1 === s2) return 1.0;
    if (s1.length < 2 || s2.length < 2) return 0;

    const getBigrams = (str: string) => {
        const bigrams = new Set<string>();
        for (let i = 0; i < str.length - 1; i++) {
            bigrams.add(str.substring(i, i + 2));
        }
        return bigrams;
    };

    const pairs1 = getBigrams(s1);
    const pairs2 = getBigrams(s2);
    const union = pairs1.size + pairs2.size;
    
    let intersection = 0;
    pairs1.forEach(p => {
        if (pairs2.has(p)) intersection++;
    });

    return (2.0 * intersection) / union;
}

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
        const model = (formData.get('model') as string) || 'claude-sonnet-4-6';
        const projectIdStr = formData.get('projectId') as string;

        if (!files || files.length === 0) {
            return NextResponse.json({ success: false, message: 'No images provided' }, { status: 400 });
        }
        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Missing projectId' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // 1. Process with AI
        const prompt = PRODUCT_OCR_PROMPT();
        let content: string;
        if (model === 'gpt-4o') {
            content = await processWithGPT4o(files, prompt);
        } else {
            content = await processWithClaude(files, prompt, model);
        }

        // 2. Parse JSON result
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

        // 3. Cross-reference with tblRelacionProductosOCR and fetch system info
        const processedProducts = [];
        for (const product of ocrResult.products) {
            // Priority 1: Check Relationship table
            const [relRows] = await connection.query<RowDataPacket[]>(
                `SELECT r.IdProducto, p.Producto as systemName, p.Codigo as systemCodigo 
                 FROM tblRelacionProductosOCR r
                 JOIN tblProductos p ON r.IdProducto = p.IdProducto
                 WHERE r.ProductoOCR = ? AND r.Status = 0`,
                [product.description]
            );

            if (relRows.length > 0) {
                processedProducts.push({
                    ...product,
                    IdCategoria: null,
                    systemId: relRows[0].IdProducto,
                    systemName: relRows[0].systemName,
                    systemCodigo: relRows[0].systemCodigo,
                    isLinked: true
                });
                continue;
            }

            // Priority 2: Check tblProductos directly by name (exact)
            const [nameRows] = await connection.query<RowDataPacket[]>(
                'SELECT IdProducto, Producto as systemName, Codigo as systemCodigo FROM tblProductos WHERE Producto = ? AND Status = 0',
                [product.description]
            );

            if (nameRows.length > 0) {
                processedProducts.push({
                    ...product,
                    IdCategoria: null,
                    systemId: nameRows[0].IdProducto,
                    systemName: nameRows[0].systemName,
                    systemCodigo: nameRows[0].systemCodigo,
                    isLinked: true // Mark as linked since it exists by name
                });
                continue;
            }

            // Priority 3: Check tblProductos by Code (exact)
            if (product.CodigoBarras) {
                const [codeRows] = await connection.query<RowDataPacket[]>(
                    'SELECT IdProducto, Producto as systemName, Codigo as systemCodigo FROM tblProductos WHERE Codigo = ? AND Status = 0',
                    [product.CodigoBarras]
                );

                if (codeRows.length > 0) {
                    processedProducts.push({
                        ...product,
                        IdCategoria: null,
                        systemId: codeRows[0].IdProducto,
                        systemName: codeRows[0].systemName,
                        systemCodigo: codeRows[0].systemCodigo,
                        isLinked: true // Mark as linked since it exists by code
                    });
                    continue;
                }
            }

            // Priority 4: Fuzzy Match (70% similarity)
            const [allProducts] = await connection.query<RowDataPacket[]>(
                'SELECT IdProducto, Producto as systemName, Codigo as systemCodigo FROM tblProductos WHERE Status = 0'
            );

            const suggestions = allProducts
                .map(p => ({
                    ...p,
                    similarity: getSimilarity(product.description, p.systemName)
                }))
                .filter(p => p.similarity >= 0.7)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, 5);

            if (suggestions.length > 0) {
                processedProducts.push({
                    ...product,
                    IdCategoria: null,
                    systemId: suggestions[0].similarity >= 0.9 ? suggestions[0].IdProducto : null,
                    systemName: suggestions[0].similarity >= 0.9 ? suggestions[0].systemName : null,
                    systemCodigo: suggestions[0].similarity >= 0.9 ? suggestions[0].systemCodigo : null,
                    isLinked: suggestions[0].similarity >= 0.9,
                    suggestions: suggestions.map(s => ({
                        id: s.IdProducto,
                        name: s.systemName,
                        code: s.systemCodigo,
                        similarity: s.similarity
                    }))
                });
                continue;
            }

            // Not found in system
            processedProducts.push({
                ...product,
                IdCategoria: null,
                systemId: null,
                systemName: null,
                systemCodigo: null,
                isLinked: false,
                suggestions: []
            });
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
