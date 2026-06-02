import { NextResponse } from 'next/server';
import { saveShare } from '@/lib/ai/shares';

const SHARE_LOCALE = 'es';

export async function POST(req: Request) {
    try {
        const { content, question, projectId, model, branchName } = await req.json();

        if (!content || typeof content !== 'string' || !content.trim()) {
            return NextResponse.json({ error: 'content requerido' }, { status: 400 });
        }
        // Cap defensivo de tamaño (las respuestas del agente son chicas)
        const safeContent = content.length > 200_000 ? content.slice(0, 200_000) : content;

        const token = await saveShare({
            content: safeContent,
            question: typeof question === 'string' ? question : undefined,
            projectId: typeof projectId === 'number' ? projectId : Number(projectId) || undefined,
            model: typeof model === 'string' ? model : undefined,
            branchName: typeof branchName === 'string' ? branchName : undefined,
        });

        // Construir la URL absoluta respetando proxy/produccion
        const proto = req.headers.get('x-forwarded-proto');
        const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
        const origin = host ? `${proto || 'https'}://${host}` : new URL(req.url).origin;
        const url = `${origin}/${SHARE_LOCALE}/r/${token}`;

        return NextResponse.json({ token, url });
    } catch (error: any) {
        console.error('AI Share Error:', error);
        return NextResponse.json({ error: 'No se pudo crear la liga', details: error.message }, { status: 500 });
    }
}
