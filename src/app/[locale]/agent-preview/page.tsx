'use client';

/**
 * Página de PREVISUALIZACIÓN (solo para verificar visualmente las features del
 * agente sin necesidad de login ni de consultar datos reales). Renderiza las
 * gráficas, los botones de navegación y el pipeline markdown→chart/nav con datos
 * de ejemplo. Segura de borrar cuando ya no se necesite.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AgentChart from '@/components/dashboard/AgentChart';
import { NavButtons } from '@/components/dashboard/AiAgent';

const onNavigate = (path: string) => alert(`Navegaría a: /es${path}`);

const mdComponents = {
    pre({ children }: any) {
        const child = Array.isArray(children) ? children[0] : children;
        const cls: string = child?.props?.className || '';
        const kids = child?.props?.children;
        const raw = (Array.isArray(kids) ? kids.join('') : String(kids ?? '')).replace(/\n$/, '');
        if (cls.includes('language-chart')) return <AgentChart json={raw} />;
        if (cls.includes('language-nav')) return <NavButtons json={raw} onNavigate={onNavigate} />;
        return <pre>{children}</pre>;
    },
};

const PROSE = 'prose prose-sm max-w-none prose-strong:text-slate-900 prose-strong:font-black prose-table:text-xs prose-th:bg-slate-50 prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-slate-200 prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-slate-100';

const sampleAnswer = `En marzo 2026 se vendieron **$1,675,300** en total. El **Comedor domina con $1,218,388** (73%), seguido por **Domicilio propio ($329,982)**, que no lleva comisión.

| Canal | Venta | Comisión |
|---|---|---|
| COMEDOR | $1,218,388 | $0 |
| UBER | $81,202 | **$28,421** |
| RAPPI | $36,214 | **$12,675** |

Las plataformas se llevan una tajada importante por comisión. Revisa el detalle:

\`\`\`chart
{"type":"bar","title":"Ventas por canal (marzo 2026)","format":"currency","data":[{"name":"Comedor","value":1218388},{"name":"Domicilio","value":329982},{"name":"Uber","value":81202},{"name":"Rappi","value":36214},{"name":"DiDi","value":9513}]}
\`\`\`

\`\`\`nav
{"items":[{"label":"Ver ventas por canal","path":"/dashboard/sales/channels","reason":"desglose y comisiones"},{"label":"Ver compras","path":"/dashboard/purchases"}]}
\`\`\``;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{title}</p>
            {children}
        </div>
    );
}

export default function AgentPreviewPage() {
    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-3xl mx-auto space-y-5">
                <header>
                    <h1 className="text-xl font-black text-slate-800">Preview · Features del Agente Foodie Guru</h1>
                    <p className="text-sm text-slate-500">Verificación visual de gráficas, navegación y render markdown.</p>
                </header>

                <div className="grid sm:grid-cols-2 gap-4">
                    <Card title="Barras (1 serie)">
                        <AgentChart json='{"type":"bar","title":"Ventas por canal","format":"currency","data":[{"name":"Comedor","value":1218388},{"name":"Domicilio","value":329982},{"name":"Uber","value":81202},{"name":"Rappi","value":36214}]}' />
                    </Card>
                    <Card title="Barras (2 series: mes vs mes)">
                        <AgentChart json='{"type":"bar","title":"Mayo vs Abril","format":"currency","seriesLabels":["Mayo","Abril"],"data":[{"name":"Comedor","value":1382567,"value2":1218388},{"name":"Uber","value":111322,"value2":81202},{"name":"Rappi","value":61777,"value2":36214}]}' />
                    </Card>
                    <Card title="Línea (evolución)">
                        <AgentChart json='{"type":"line","title":"Ventas por mes","format":"currency","data":[{"name":"Ene","value":1200000},{"name":"Feb","value":1350000},{"name":"Mar","value":1675300},{"name":"Abr","value":1820000},{"name":"May","value":1957169}]}' />
                    </Card>
                    <Card title="Pastel (distribución)">
                        <AgentChart json='{"type":"pie","title":"Participación por canal","format":"currency","data":[{"name":"Comedor","value":1218388},{"name":"Domicilio","value":329982},{"name":"Uber","value":81202},{"name":"Rappi","value":36214},{"name":"DiDi","value":9513}]}' />
                    </Card>
                </div>

                <Card title="Botones de navegación (haz clic)">
                    <NavButtons
                        json='{"items":[{"label":"Ver ventas por canal","path":"/dashboard/sales/channels","reason":"detalle"},{"label":"Ver compras","path":"/dashboard/purchases"},{"label":"Productos bajo mínimo","path":"/dashboard/inventories/min-max"}]}'
                        onNavigate={onNavigate}
                    />
                </Card>

                <Card title="Render markdown end-to-end (como en el chat)">
                    <div className={PROSE}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                            {sampleAnswer}
                        </ReactMarkdown>
                    </div>
                </Card>
            </div>
        </div>
    );
}
