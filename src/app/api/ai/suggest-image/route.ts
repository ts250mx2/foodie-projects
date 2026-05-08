import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { productName } = await request.json();
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

        // Use DALL-E 3 for high quality realistic photos
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt: `A professional, high-quality realistic studio photo of ${productName} for a food catalog or restaurant inventory. High resolution, clear details, neutral background.`,
                n: 1,
                size: '1024x1024',
                response_format: 'b64_json'
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('OpenAI Error:', data);
            return NextResponse.json({ success: false, message: data.error?.message || 'Error generating image' });
        }

        if (data.data && data.data[0]) {
            return NextResponse.json({ 
                success: true, 
                image: `data:image/png;base64,${data.data[0].b64_json}` 
            });
        }

        return NextResponse.json({ success: false, message: 'No image data returned' });
    } catch (error: any) {
        console.error('AI Suggest Image Error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
