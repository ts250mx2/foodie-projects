'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { Sparkles, Trash2, Maximize2, Minimize2, X, Send, Bot, ChevronRight, FileDown, ArrowUpRight } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import AgentChart from '@/components/dashboard/AgentChart';

// Botones de navegación que el agente embebe como ```nav {json}```.
function NavButtons({ json, onNavigate }: { json: string; onNavigate: (path: string) => void }) {
    let items: { label: string; path: string; reason?: string }[] = [];
    try { const p = JSON.parse(json); items = Array.isArray(p.items) ? p.items : []; } catch { return null; }
    if (!items.length) return null;
    return (
        <div className="not-prose flex flex-wrap gap-2 my-2">
            {items.map((it, i) => (
                <button key={i} onClick={() => it.path && onNavigate(it.path)} title={it.reason}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 hover:brightness-95"
                    style={{ borderColor: '#f4481e40', background: '#f4481e0d', color: '#c2410c' }}>
                    <ArrowUpRight size={13} />
                    {it.label}
                </button>
            ))}
        </div>
    );
}

// Durante el streaming, oculta un bloque cercado (```chart / ```nav) aún sin
// cerrar para no mostrar JSON crudo; el bloque aparece cuando se completa.
function hideIncompleteFence(text: string): string {
    const fences = (text.match(/```/g) || []).length;
    if (fences % 2 === 0) return text;          // todo cerrado
    const idx = text.lastIndexOf('```');
    return text.slice(0, idx).trimEnd();
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    clarification?: { question: string; suggestions: string[] };
    ts?: number;
}

type ClaudeModel = 'claude-opus-4-8' | 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001';

const CLAUDE_MODELS: { id: ClaudeModel; label: string; badge: string }[] = [
    { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6', badge: '⚡' },
    { id: 'claude-opus-4-8',           label: 'Opus 4.8',   badge: '🧠' },
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',  badge: '🪶' },
];

const CHAT_STORAGE_KEY = 'foodie-guru-chat-v2';

interface AiAgentProps {
    mode?: 'floating' | 'embedded';
    dashboardData?: any;
}

// ─── Page suggestions ─────────────────────────────────────────────────────────
const PAGE_SUGGESTIONS: Record<string, string[]> = {
    '/dashboard/sales': [
        '¿Cuáles son mis ventas por canal de venta este mes?',
        '¿Qué forma de pago genera más venta?',
        '¿Qué turno concentra más ventas?',
        '¿Cuánta comisión acumulé en canales de venta este mes?',
    ],
    '/dashboard/expenses': [
        '¿Cuáles son mis conceptos de gasto más altos?',
        '¿Cuánto gasté en comisiones de canales de venta?',
        '¿Cómo comparan mis gastos este mes vs el anterior?',
    ],
    '/dashboard/purchases': [
        '¿Cuáles son mis proveedores con mayor gasto este mes?',
        '¿Cuánto he invertido en compras este mes?',
        '¿Qué productos compro más frecuentemente?',
    ],
    '/dashboard/inventories': [
        '¿Qué productos tienen mayor consumo este mes?',
        '¿Qué productos están por debajo del mínimo?',
        '¿Cuál es el valor estimado de mi inventario?',
    ],
    '/dashboard/payroll': [
        '¿Cuánto pagué de nómina este mes?',
        '¿Cuál es mi costo de nómina por sucursal?',
        '¿Qué empleados tienen mayor pago acumulado?',
    ],
    '/dashboard/production': [
        '¿Cuáles son mis platillos más producidos este mes?',
        '¿Cuál es el costo de materia prima de mi producción?',
        '¿Qué recetas tienen mayor costo?',
    ],
    '/dashboard': [
        '¿Cuánto vendimos este mes vs el mes pasado?',
        '¿Cuáles son mis gastos más grandes este mes?',
        '¿Cuál es mi utilidad estimada este mes?',
        '¿Cómo va mi nómina vs ventas este mes?',
    ],
};

function getPageSuggestions(pathname: string): string[] {
    const segments = [
        '/dashboard/sales', '/dashboard/expenses', '/dashboard/purchases',
        '/dashboard/inventories', '/dashboard/payroll', '/dashboard/production',
    ];
    for (const seg of segments) {
        if (pathname.includes(seg)) return PAGE_SUGGESTIONS[seg];
    }
    return PAGE_SUGGESTIONS['/dashboard'];
}

function getContextFromLocalStorage() {
    if (typeof window === 'undefined') return {};
    try {
        const project  = JSON.parse(localStorage.getItem('project') || '{}');
        const branchId = localStorage.getItem('dashboardSelectedBranch') || '';
        const rawMonth = localStorage.getItem('lastSelectedMonth');
        const rawYear  = localStorage.getItem('lastSelectedYear');
        const now      = new Date();

        // Convert 0-indexed JS month → 1-indexed for DB
        const dashboardMonth = rawMonth !== null
            ? parseInt(rawMonth) + 1
            : now.getMonth() + 1;
        const dashboardYear = rawYear ? parseInt(rawYear) : now.getFullYear();

        return {
            project,
            branchId,
            dashboardMonth,   // 1-indexed, already ready for SQL
            dashboardYear,
            todayMonth: now.getMonth() + 1,  // 1-indexed
            todayYear:  now.getFullYear(),
            todayISO:   now.toISOString().split('T')[0],
        };
    } catch {
        return {};
    }
}

// ─── Typing animation ─────────────────────────────────────────────────────────
function TypingIndicator() {
    const { colors } = useTheme();
    return (
        <div className="flex items-center gap-1 px-1 py-0.5">
            {[0, 1, 2].map(i => (
                <span
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                        backgroundColor: colors.colorFondo1,
                        animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
                    }}
                />
            ))}
        </div>
    );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────
function ChatPanel({
    messages, isLoading, input, setInput, handleSend,
    model, setModel, onClear, onMaximize, onClose,
    isMaximized, mode, suggestions, messagesEndRef,
    streamingText, streamPhase, onNavigate,
}: {
    messages: Message[];
    isLoading: boolean;
    input: string;
    setInput: (v: string) => void;
    handleSend: (e: React.FormEvent) => void;
    model: ClaudeModel;
    setModel: (v: ClaudeModel) => void;
    onClear: () => void;
    onMaximize?: () => void;
    onClose?: () => void;
    isMaximized?: boolean;
    mode: 'floating' | 'embedded';
    suggestions: string[];
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    streamingText?: string | null;
    streamPhase?: string | null;
    onNavigate: (path: string) => void;
}) {
    const { colors } = useTheme();
    const currentModelInfo = CLAUDE_MODELS.find(m => m.id === model) ?? CLAUDE_MODELS[0];
    const [isInputFocused, setIsInputFocused] = useState(false);

    // Render de Markdown: intercepta ```chart (gráfica) y ```nav (botones).
    const mdComponents = useMemo(() => ({
        pre({ children }: any) {
            const child = Array.isArray(children) ? children[0] : children;
            const cls: string = child?.props?.className || '';
            const kids = child?.props?.children;
            const raw = (Array.isArray(kids) ? kids.join('') : String(kids ?? '')).replace(/\n$/, '');
            if (cls.includes('language-chart')) return <AgentChart json={raw} />;
            if (cls.includes('language-nav')) return <NavButtons json={raw} onNavigate={onNavigate} />;
            return <pre>{children}</pre>;
        },
    }), [onNavigate]);

    const sendSuggestion = (text: string) => {
        setInput(text);
        setTimeout(() => {
            (document.getElementById('agent-chat-form') as HTMLFormElement)?.requestSubmit();
        }, 0);
    };

    // Exporta una respuesta del asistente a PDF. Carga jsPDF en demanda (lazy)
    // para no inflar el bundle inicial del dashboard.
    const exportMsg = async (idx: number) => {
        const msg = messages[idx];
        if (!msg || msg.role !== 'assistant' || !msg.content) return;
        const prev = messages[idx - 1];
        const question = prev && prev.role === 'user' ? prev.content : undefined;
        const modelLabel = CLAUDE_MODELS.find(m => m.id === model)?.label;
        try {
            const { generateAnswerPDF } = await import('@/utils/generateAnswerPDF');
            generateAnswerPDF(msg.content, { question, model: modelLabel });
        } catch (err) {
            console.error('No se pudo generar el PDF:', err);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: '#fcfbfa' }}>

            {/* ── Header ───────────────────────────────────────────────────── */}
            {mode === 'floating' ? (
                <div className="shrink-0 relative overflow-hidden text-white" 
                     style={{ 
                          background: 'linear-gradient(135deg, var(--color-brand-orange, #f4481e) 0%, #db340a 100%)'
                      }}>
                    {/* decorative glowing circles */}
                    <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10 blur-lg pointer-events-none" />
                    <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/5 blur-md pointer-events-none" />

                    <div className="relative px-4 py-3.5 flex items-center justify-between text-white z-10">
                        <div className="flex items-center gap-3">
                            {/* Avatar with yellow background accent from PDF */}
                            <div className="relative">
                                <div className="w-10 h-10 rounded-2xl bg-[var(--color-brand-yellow,#f8e14c)] flex items-center justify-center text-xl shadow-lg border border-white/20">
                                    👨‍🍳
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white/30" style={{ backgroundColor: 'var(--color-brand-green, #34b14a)' }} />
                            </div>
                            <div>
                                <h1 className="text-white brand-heading text-sm leading-none tracking-wider">Agente Foodie Gurú</h1>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-emerald-200 text-[10px] font-black flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full inline-block animate-ping" style={{ backgroundColor: 'var(--color-brand-green, #34b14a)', animationDuration: '2s' }} />
                                        En línea
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            <button onClick={onClear} title="Nueva conversación"
                                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all">
                                <Trash2 size={14} />
                            </button>

                            {onMaximize && (
                                <button onClick={onMaximize} title="Maximizar en pantalla completa"
                                    className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all">
                                    <Maximize2 size={14} />
                                </button>
                            )}

                            {onClose && (
                                <button onClick={onClose} title="Cerrar"
                                    className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all">
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Embedded header with brand orange background, white text, and rich brand information */
                <div className="shrink-0 flex items-center justify-between px-5 py-4 text-white relative overflow-hidden" 
                     style={{ 
                          backgroundColor: 'var(--color-brand-orange, #f4481e)' 
                      }}>
                    {/* decorative circles */}
                    <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
                    <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-white/5" />

                    <div className="relative flex items-center gap-3.5 z-10">
                        {/* Avatar with yellow background accent from PDF */}
                        <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-yellow,#f8e14c)] flex items-center justify-center text-xl shadow-lg border border-white/20">
                                👨‍🍳
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white/30" style={{ backgroundColor: 'var(--color-brand-green, #34b14a)' }} />
                        </div>
                        <div>
                            <h1 className="text-white brand-heading text-lg leading-none tracking-wider">Agente Foodie Gurú</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-emerald-200 text-xs font-black flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full inline-block animate-ping" style={{ backgroundColor: 'var(--color-brand-green, #34b14a)' }} />
                                    En línea
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/30" />
                                <span className="text-white/80 text-xs font-semibold">
                                    Tu consultor de rentabilidad en tiempo real
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="relative flex items-center gap-4 z-10">
                        {/* Clear button */}
                        <button
                            onClick={onClear}
                            title="Nueva conversación"
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all active:scale-[0.98] shadow-sm"
                        >
                            <Trash2 size={13} className="text-white" />
                            <span>Limpiar Chat</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ── Messages area with brand pattern background ───────────────── */}
            <div className="flex-1 overflow-y-auto scroll-smooth px-5 py-5 space-y-5"
                 style={{ 
                     backgroundColor: '#fdfcfb',
                     backgroundImage: 'radial-gradient(rgba(244, 72, 30, 0.04) 1.2px, transparent 1.2px)',
                     backgroundSize: '20px 20px'
                 }}>

                {/* Empty state */}
                {messages.length === 0 && (
                    <div className="animate-in fade-in zoom-in-95 duration-500 pt-2">
                        {/* Beautiful welcoming card */}
                        <div className="bg-white/90 backdrop-blur-md border border-slate-100/80 rounded-3xl p-6 shadow-sm max-w-sm mx-auto mb-6 text-center">
                            <div className="relative inline-flex mb-4">
                                {/* Glow effect behind avatar */}
                                <div className="absolute inset-0 bg-amber-400/20 rounded-3xl blur-xl animate-pulse" />
                                <div className="relative w-16 h-16 rounded-3xl bg-amber-50/50 border border-brand-yellow/40 flex items-center justify-center text-3xl shadow-md animate-float">
                                    👨‍🍳
                                </div>
                            </div>
                            <h3 className="brand-heading text-lg text-slate-800 leading-tight mb-2 tracking-wider">
                                ¡Hola! Soy Foodie Guru
                            </h3>
                            <p className="text-slate-500 text-xs leading-relaxed max-w-xs mx-auto font-medium">
                                Tu consultor de rentabilidad restaurantera en tiempo real. 
                                ¿En qué te puedo ayudar hoy a mejorar tus números?
                            </p>
                        </div>

                        {/* Suggestions */}
                        <div className="space-y-2.5 max-w-md mx-auto">
                            <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 px-2 mb-2">
                                Sugerencias para esta sección
                            </p>
                            {suggestions.map((s, i) => (
                                <button key={i} onClick={() => sendSuggestion(s)}
                                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white border border-slate-200/80 text-slate-700 text-sm font-semibold transition-all duration-350 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:translate-x-1 group text-left"
                                    style={{
                                        borderLeft: '4px solid var(--color-brand-orange, #f4481e)'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = 'rgba(244, 72, 30, 0.3)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                    }}
                                >
                                    <span className="group-hover:text-brand-orange transition-colors duration-200 pr-2">{s}</span>
                                    <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-orange group-hover:translate-x-0.5 transition-all shrink-0" />
                                </button>
                            ))}
                        </div>

                        {/* Info pill */}
                        <div className="flex items-center justify-center gap-2 mt-6">
                            <Sparkles size={11} className="text-amber-500" />
                            <span className="text-[10px] text-slate-400 font-medium">
                                Potenciado por Claude AI · {currentModelInfo.label}
                            </span>
                        </div>
                    </div>
                )}

                {/* Messages */}
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-300 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`flex gap-2.5 max-w-[88%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar */}
                            {msg.role === 'assistant' && (
                                <div className="w-7 h-7 rounded-xl shrink-0 mt-0.5 flex items-center justify-center text-sm shadow-sm border border-slate-200/50"
                                    style={{ background: 'linear-gradient(135deg, #ffffff, #f1f5f9)' }}>
                                    👨‍🍳
                                </div>
                            )}

                            {/* Bubble */}
                            <div className={`rounded-2xl px-4 py-3.5 text-sm leading-relaxed shadow-sm transition-all duration-200 ${
                                msg.role === 'user'
                                    ? 'font-semibold hover:shadow-md'
                                    : 'border text-slate-800 rounded-tl-sm hover:shadow-md'
                            }`}
                            style={msg.role === 'user' ? {
                                background: 'linear-gradient(135deg, var(--color-brand-yellow, #f8e14c) 0%, #f6d833 100%)',
                                color: '#0a0a0a',
                                borderRadius: '20px 20px 4px 20px',
                                boxShadow: '0 4px 14px -4px rgba(248, 225, 76, 0.4)'
                            } : {
                                backgroundColor: 'rgba(245, 240, 226, 0.65)',
                                borderColor: 'rgba(226, 232, 240, 0.5)'
                            }}>
                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1.5 prose-headings:font-bold prose-headings:text-slate-800 prose-headings:my-2 prose-strong:text-slate-900 prose-strong:font-black prose-table:text-xs prose-table:border-collapse prose-th:bg-slate-50 prose-th:text-slate-800 prose-th:font-bold prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-slate-200 prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-slate-100 prose-ul:my-1.5 prose-li:my-0.5 prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-code:text-xs prose-code:text-slate-700">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : msg.content}
                            </div>
                        </div>

                        {/* Export PDF — solo respuestas de análisis (no aclaraciones) */}
                        {msg.role === 'assistant' && !msg.clarification && msg.content?.trim() && (
                            <button
                                onClick={() => exportMsg(idx)}
                                title="Exportar esta respuesta a PDF"
                                className="ml-9 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all active:scale-95"
                            >
                                <FileDown size={12} />
                                Exportar PDF
                            </button>
                        )}

                        {/* Clarification chips */}
                        {msg.role === 'assistant' && msg.clarification?.suggestions && (
                            <div className="ml-9 flex flex-wrap gap-2">
                                {msg.clarification.suggestions.map((s, si) => (
                                    <button key={si} onClick={() => sendSuggestion(s)}
                                        className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 shadow-sm"
                                        style={{
                                            borderColor: `${colors?.colorFondo1 || '#3b3be8'}30`,
                                            background: `${colors?.colorFondo1 || '#3b3be8'}08`,
                                            color: colors?.colorFondo1 || '#3b3be8'
                                        }}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLButtonElement).style.background = `${colors?.colorFondo1 || '#3b3be8'}18`;
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLButtonElement).style.background = `${colors?.colorFondo1 || '#3b3be8'}08`;
                                        }}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* Streaming bubble — el texto del asistente mientras llega */}
                {typeof streamingText === 'string' && streamingText.length > 0 && (
                    <div className="flex gap-2.5 max-w-[88%] items-start animate-in fade-in duration-200">
                        <div className="w-7 h-7 rounded-xl shrink-0 mt-0.5 flex items-center justify-center text-sm shadow-sm border border-slate-200/50"
                            style={{ background: 'linear-gradient(135deg, #ffffff, #f1f5f9)' }}>
                            👨‍🍳
                        </div>
                        <div className="bg-white border border-slate-100 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
                            <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1.5 prose-headings:font-bold prose-headings:text-slate-800 prose-headings:my-2 prose-strong:text-slate-900 prose-strong:font-black prose-table:text-xs prose-table:border-collapse prose-th:bg-slate-50 prose-th:text-slate-800 prose-th:font-bold prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-slate-200 prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-slate-100 prose-ul:my-1.5 prose-li:my-0.5 prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-code:text-xs prose-code:text-slate-700">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                                    {hideIncompleteFence(streamingText)}
                                </ReactMarkdown>
                            </div>
                            <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle rounded-sm animate-pulse"
                                style={{ backgroundColor: colors?.colorFondo1 || '#f4481e' }} />
                        </div>
                    </div>
                )}

                {/* Loading / fase — solo antes del primer token o entre consultas */}
                {isLoading && !(typeof streamingText === 'string' && streamingText.length > 0) && (
                    <div className="flex items-center gap-2.5 animate-in fade-in duration-300">
                        <div className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-sm shadow-sm border border-slate-200/50"
                            style={{ background: 'linear-gradient(135deg, #ffffff, #f1f5f9)' }}>
                            👨‍🍳
                        </div>
                        <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                            <TypingIndicator />
                            {streamPhase && streamPhase !== 'writing' && (
                                <span className="text-[11px] font-semibold text-slate-400">
                                    {streamPhase === 'querying' ? 'Consultando tus datos…'
                                        : streamPhase === 'analyzing' ? 'Analizando…'
                                        : 'Pensando…'}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* ── Input & Controls ─────────────────────────────────────────── */}
            <div className="shrink-0 px-5 pb-5 pt-3 bg-white border-t border-slate-100 shadow-[0_-8px_30px_rgb(0,0,0,0.015)] flex flex-col gap-2.5">
                
                {/* Model Selector Bar */}
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-extrabold uppercase tracking-wider pb-1.5 px-1 border-b border-slate-50">
                    <span>Modelo de Inteligencia Artificial:</span>
                    <div className="relative">
                        <select
                            value={model}
                            onChange={e => setModel(e.target.value as ClaudeModel)}
                            className="text-[10px] font-bold bg-slate-50 border border-slate-150 text-slate-700 rounded-lg px-2 py-0.5 outline-none cursor-pointer hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm"
                        >
                            {CLAUDE_MODELS.map(m => (
                                <option key={m.id} value={m.id} className="text-slate-800 bg-white">
                                    {m.badge} {m.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <form id="agent-chat-form" onSubmit={handleSend} className="w-full">
                    <div 
                        className="flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-all duration-300 shadow-sm"
                        style={{
                            border: `1px solid ${isInputFocused ? 'var(--color-brand-orange, #f4481e)' : '#e2e8f0'}`,
                            boxShadow: isInputFocused ? '0 0 0 4px rgba(244, 72, 30, 0.15)' : 'none',
                            backgroundColor: isInputFocused ? '#ffffff' : '#f8fafc'
                        }}
                    >
                        <Bot size={18} className={`transition-colors duration-300 ${isInputFocused ? 'text-brand-orange' : 'text-slate-400'}`} style={isInputFocused ? { color: 'var(--color-brand-orange)' } : { color: '#94a3b8' }} />
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            placeholder="Pregunta sobre tu negocio..."
                            className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none font-medium min-w-0"
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || !input.trim()}
                            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-brand-yellow/10 hover:shadow-brand-yellow/25 hover:-translate-y-0.5 active:translate-y-0"
                            style={!isLoading && input.trim()
                                ? { 
                                    background: 'linear-gradient(135deg, var(--color-brand-yellow, #f8e14c) 0%, #f6d833 100%)', 
                                    color: '#0a0a0a' 
                                  }
                                : { backgroundColor: '#e2e8f0', color: '#94a3b8', boxShadow: 'none' }}>
                            <Send size={14} />
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 text-center mt-2 font-medium">
                        Puede cometer errores · Verifica cifras importantes
                    </p>
                </form>
            </div>

            <style jsx global>{`
                @keyframes bounce {
                    0%, 60%, 100% { transform: translateY(0); }
                    30% { transform: translateY(-6px); }
                }
            `}</style>
        </div>
    );
}


// ─── Main component ───────────────────────────────────────────────────────────
export default function AiAgent({ mode = 'floating', dashboardData }: AiAgentProps) {
    const pathname = usePathname();
    const router   = useRouter();
    const params   = useParams();
    const locale   = (params?.locale as string) || 'es';

    const [isOpen,        setIsOpen]        = useState(false);
    const [messages,      setMessages]      = useState<Message[]>([]);
    const [input,         setInput]         = useState('');
    const [isLoading,     setIsLoading]     = useState(false);
    const [model,         setModel]         = useState<ClaudeModel>('claude-sonnet-4-6');
    const [hydrated,      setHydrated]      = useState(false);
    const [streamingText, setStreamingText] = useState<string | null>(null);
    const [streamPhase,   setStreamPhase]   = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // ── Load persisted conversation ────────────────────────────────────────
    useEffect(() => {
        try {
            const saved = localStorage.getItem(CHAT_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed.messages)) setMessages(parsed.messages);
                if (CLAUDE_MODELS.some(m => m.id === parsed.model)) setModel(parsed.model);
            }
        } catch { }
        setHydrated(true);
    }, []);

    // ── Persist conversation on change ────────────────────────────────────
    useEffect(() => {
        if (!hydrated) return;
        try {
            if (messages.length > 0) {
                localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages, model }));
            } else {
                localStorage.removeItem(CHAT_STORAGE_KEY);
            }
        } catch { }
    }, [messages, model, hydrated]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen, streamingText]);

    const suggestions = getPageSuggestions(pathname || '');

    const handleSend = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: input, ts: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        setStreamPhase('thinking');
        setStreamingText(null);

        let streamed   = '';   // texto acumulado del turno final (fuente de verdad)
        let committed  = false; // ya volcamos el texto a un mensaje permanente

        try {
            const ctx = dashboardData || getContextFromLocalStorage();
            const projectId =
                dashboardData?.project?.idProyecto ||
                dashboardData?.project?.IdProyecto ||
                (ctx as any)?.project?.idProyecto  ||
                (ctx as any)?.project?.IdProyecto;

            const res = await fetch('/api/ai/chat?stream=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
                    model,
                    context: { ...ctx, currentPage: pathname },
                    projectId,
                }),
            });

            if (!res.ok || !res.body) {
                throw new Error('No se pudo conectar con el agente.');
            }

            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let stop   = false;

            while (!stop) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const frames = buffer.split('\n\n');
                buffer = frames.pop() || '';

                for (const frame of frames) {
                    const dataLine = frame.split('\n').find(l => l.startsWith('data:'));
                    if (!dataLine) continue;
                    let evt: any;
                    try { evt = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }

                    switch (evt.type) {
                        case 'status':
                            setStreamPhase(evt.phase);
                            break;
                        case 'text':
                            streamed += evt.delta;
                            setStreamingText(streamed);
                            break;
                        case 'reset':
                            streamed = '';
                            setStreamingText('');
                            break;
                        case 'clarification':
                            streamed = '';
                            committed = true;
                            setStreamingText(null);
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: evt.question,
                                clarification: { question: evt.question, suggestions: evt.suggestions || [] },
                                ts: Date.now(),
                            }]);
                            break;
                        case 'done':
                            if (!committed) {
                                const finalContent = streamed || evt.content || '';
                                if (finalContent) {
                                    setMessages(prev => [...prev, { role: 'assistant', content: finalContent, ts: Date.now() }]);
                                }
                                committed = true;
                            }
                            setStreamingText(null);
                            if (evt.executedSql) {
                                console.groupCollapsed('🔍 Foodie Guru – SQL');
                                console.log(evt.executedSql);
                                console.groupEnd();
                            }
                            stop = true;
                            break;
                        case 'error':
                            committed = true;
                            setStreamingText(null);
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: `Lo siento, ocurrió un error: ${evt.message || 'desconocido'}`,
                                ts: Date.now(),
                            }]);
                            stop = true;
                            break;
                    }
                }
            }

            // Si el stream se cortó sin 'done' pero alcanzamos a recibir texto.
            if (!committed && streamed) {
                setMessages(prev => [...prev, { role: 'assistant', content: streamed, ts: Date.now() }]);
            }
        } catch (err: any) {
            if (!committed) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `Lo siento, ocurrió un error: ${err.message}`,
                    ts: Date.now(),
                }]);
            }
        } finally {
            setStreamingText(null);
            setStreamPhase(null);
            setIsLoading(false);
        }
    }, [input, isLoading, messages, model, pathname, dashboardData]);

    const handleClear = () => {
        setMessages([]);
        localStorage.removeItem(CHAT_STORAGE_KEY);
    };

    // Navega a una pantalla del dashboard (desde un bloque ```nav del agente).
    const handleNavigate = useCallback((path: string) => {
        if (!path?.startsWith('/')) return;
        router.push(`/${locale}${path}`);
        setIsOpen(false); // cierra el widget flotante; en modo embedded no aplica
    }, [router, locale]);

    const sharedProps = {
        messages, isLoading, input, setInput, handleSend,
        model, setModel, onClear: handleClear, suggestions, messagesEndRef,
        streamingText, streamPhase, onNavigate: handleNavigate,
    };

    // ── EMBEDDED ──────────────────────────────────────────────────────────
    if (mode === 'embedded') {
        return (
            <div className="h-full w-full rounded-none overflow-hidden border-none">
                <ChatPanel {...sharedProps} mode="embedded" />
            </div>
        );
    }

    // ── FLOATING ──────────────────────────────────────────────────────────
    const hasMessages = messages.length > 0;
    const { colors } = useTheme();

    return (
        <div className="fixed bottom-6 right-6 z-[99999]">
            {/* FAB button */}
            {!isOpen && (
                <button onClick={() => setIsOpen(true)}
                    className="group relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300"
                    style={{ 
                        backgroundColor: 'var(--color-brand-orange, #f4481e)',
                        backgroundImage: 'none'
                    }}
                    title="Agente Foodie Guru">
                    <span className="text-2xl group-hover:scale-110 transition-transform duration-200">👨‍🍳</span>
                    {/* unread dot */}
                    {hasMessages && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white text-[8px] font-black text-white flex items-center justify-center">
                            {messages.filter(m => m.role === 'assistant').length > 9
                                ? '9+' : messages.filter(m => m.role === 'assistant').length || ''}
                        </span>
                    )}
                    {/* pulse ring */}
                    <span className="absolute inset-0 rounded-2xl animate-ping" style={{ boxShadow: `0 0 0 4px var(--color-brand-orange, #f4481e)40`, animationDuration: '3s' }} />
                </button>
            )}

            {/* Chat window */}
            {isOpen && (
                <div className="absolute bottom-0 right-0 rounded-3xl overflow-hidden border border-white/20 shadow-2xl transition-all duration-500 ease-out animate-in slide-in-from-bottom-4 zoom-in-95 w-[400px] h-[620px]"
                style={{ boxShadow: '0 32px 64px -12px rgba(79,70,229,0.25), 0 0 0 1px rgba(255,255,255,0.1)' }}>
                    <ChatPanel
                        {...sharedProps}
                        onMaximize={() => {
                            router.push(`/${locale}/dashboard/agente`);
                            setIsOpen(false);
                        }}
                        onClose={() => { setIsOpen(false); }}
                        mode="floating"
                    />
                </div>
            )}
        </div>
    );
}
