import type { Metadata } from 'next';
import { getShare } from '@/lib/ai/shares';
import AgentShareView from '@/components/AgentShareView';

interface PageParams { params: Promise<{ locale: string; token: string }> }

// Open Graph para que WhatsApp/redes muestren una tarjeta de preview.
export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
    const { token } = await params;
    const share = await getShare(token).catch(() => null);
    const title = share?.question ? `Foodie Guru · ${share.question}` : 'Foodie Guru · Análisis';
    const description = share
        ? (share.content.replace(/[#*`>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160) + '…')
        : 'Liga de análisis del agente Foodie Guru.';
    return {
        title,
        description,
        openGraph: { title, description, type: 'article' },
        robots: { index: false, follow: false }, // ligas privadas: no indexar
    };
}

function NotFound() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-sm text-center">
                <div className="text-4xl mb-3">👨‍🍳</div>
                <h1 className="text-lg font-black text-slate-800">Liga no disponible</h1>
                <p className="text-sm text-slate-500 mt-2">
                    Esta liga de análisis no existe o ya expiró. Pídele al agente que genere una nueva.
                </p>
            </div>
        </div>
    );
}

export default async function SharePage({ params }: PageParams) {
    const { token } = await params;
    const share = await getShare(token).catch(() => null);
    if (!share) return <NotFound />;

    const dateStr = share.createdAt.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

    return (
        <AgentShareView
            content={share.content}
            question={share.question}
            dateStr={dateStr}
            model={share.model}
            branchName={share.branchName}
        />
    );
}
