import { NextRequest, NextResponse } from 'next/server';

const OCR_PROMPT = 'Analyze these receipt images. Extract the provider name, the total amount, the ticket/receipt number (if available), the date of the receipt (YYYY-MM-DD), and a detailed list of concepts/items with their quantity and price. Return ONLY a JSON object with this structure: {"provider": "NAME", "total": 0.00, "ticketNumber": "12345", "date": "2024-03-19", "concepts": [{"description": "Item Name", "quantity": 1, "price": 0.00, "total": 0.00}]}. Ensure numeric values are numbers, not strings. IMPORTANT: Close the JSON object correctly, do not leave it truncated.';

async function processWithClaude(files: File[]): Promise<string> {
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
            model: 'claude-opus-4-6',
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: [
                    ...imageContents,
                    { type: 'text', text: OCR_PROMPT }
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

async function processWithGPT4o(files: File[]): Promise<string> {
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
                    { type: 'text', text: OCR_PROMPT }
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
    try {
        const formData = await request.formData();
        const files = formData.getAll('image') as File[];
        const model = (formData.get('model') as string) || 'claude-opus-4-6';

        if (!files || files.length === 0) {
            return NextResponse.json({ success: false, message: 'No images provided' }, { status: 400 });
        }

        let content: string;
        if (model === 'gpt-4o') {
            content = await processWithGPT4o(files);
        } else {
            content = await processWithClaude(files);
        }

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
