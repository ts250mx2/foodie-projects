'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileDown } from 'lucide-react';
import AgentChart from '@/components/dashboard/AgentChart';

// Render de la respuesta compartida: soporta ```chart (gráfica). Los bloques
// ```nav se omiten porque la navegación al dashboard no aplica en una liga
// pública de solo lectura.
const shareMdComponents = {
    pre({ children }: any) {
        const child = Array.isArray(children) ? children[0] : children;
        const cls: string = child?.props?.className || '';
        if (cls.includes('language-chart')) {
            const kids = child?.props?.children;
            const raw = (Array.isArray(kids) ? kids.join('') : String(kids ?? '')).replace(/\n$/, '');
            return <AgentChart json={raw} />;
        }
        if (cls.includes('language-nav')) return null; // sin navegación en la vista pública
        return <pre>{children}</pre>;
    },
};

const PROSE = 'prose prose-sm sm:prose-base max-w-none prose-p:leading-relaxed prose-headings:text-slate-800 prose-strong:text-slate-900 prose-strong:font-black prose-table:text-xs prose-th:bg-slate-50 prose-th:text-slate-800 prose-th:font-bold prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-slate-200 prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-slate-100 prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded';

interface Props {
    content: string;
    question?: string | null;
    dateStr?: string;
    model?: string | null;
    branchName?: string | null;
    projectId?: number | null;
}

export default function AgentShareView({ content, question, dateStr, model, branchName, projectId }: Props) {
    const exportPdf = async () => {
        try {
            let logo64 = '';
            let projectName = '';
            if (projectId) {
                try {
                    const resp = await fetch(`/api/project-header?projectId=${projectId}`);
                    const headerData = await resp.json();
                    if (headerData.success) {
                        logo64 = headerData.logo64 || '';
                        projectName = headerData.titulo || '';
                    }
                } catch (e) {
                    console.warn('Error fetching header for pdf logo:', e);
                }
            }

            // Capturar las gráficas de la página si existen en el DOM
            const chartImages: string[] = [];
            const el = document.getElementById('agent-share-content');
            if (el) {
                const chartElements = el.querySelectorAll('.agent-chart-card');
                if (chartElements.length > 0) {
                    try {
                        const htmlToImage = await import('html-to-image');
                        for (let i = 0; i < chartElements.length; i++) {
                            const dataUrl = await htmlToImage.toPng(chartElements[i] as HTMLElement, {
                                backgroundColor: '#ffffff',
                                pixelRatio: 2,
                                cacheBust: true,
                            });
                            chartImages.push(dataUrl);
                        }
                    } catch (chartErr) {
                        console.warn('Error rendering chart elements to PNG data urls:', chartErr);
                    }
                }
            }

            const { generateAnswerPDF } = await import('@/utils/generateAnswerPDF');
            generateAnswerPDF(content, {
                question: question || undefined,
                model: model || undefined,
                branchName: branchName || undefined,
                projectLogo: logo64 || undefined,
                projectName: projectName || undefined,
                chartImages: chartImages.length > 0 ? chartImages : undefined
            });
        } catch (e) {
            console.error('No se pudo generar el PDF:', e);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header de marca */}
            <header className="text-white" style={{ backgroundColor: 'var(--color-brand-orange, #f4481e)' }}>
                <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-xl shadow">
                        👨‍🍳
                    </div>
                    <div>
                        <p className="font-black text-base leading-tight">Foodie Guru</p>
                        <p className="text-white/85 text-xs">Análisis del agente de rentabilidad{branchName ? ` · ${branchName}` : ''}</p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            {question && <p className="text-sm font-bold text-slate-800 truncate">{question}</p>}
                            {dateStr && <p className="text-xs text-slate-400 mt-0.5">{dateStr}</p>}
                        </div>
                        <button
                            onClick={exportPdf}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm active:scale-95 transition-all"
                            style={{ backgroundColor: 'var(--color-brand-orange, #f4481e)' }}
                        >
                            <FileDown size={13} /> PDF
                        </button>
                    </div>

                    <div className="px-5 py-5" id="agent-share-content">
                        <div className={PROSE}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={shareMdComponents}>
                                {content}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                <p className="text-center text-[11px] text-slate-400 mt-4">
                    Foodie Guru · Puede cometer errores, verifica cifras importantes
                </p>
            </main>
        </div>
    );
}
