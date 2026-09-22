'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePathname, useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { Sparkles, Trash2, Maximize2, Minimize2, X, Send, Bot, ChevronRight, ArrowUpRight, Link2, Check, Loader2, ChefHat, Mic } from 'lucide-react';
import { FcDocument } from 'react-icons/fc';
import { useTheme } from '@/contexts/ThemeContext';
import AgentChart from '@/components/dashboard/AgentChart';
import PageShell from '@/components/PageShell';
import { chatStorageKey, clearLegacyChatHistory, currentProjectId } from '@/lib/ai-chat-storage';

// Botones de navegación que el agente embebe como ```nav {json}```.
const NOMBRE_PROVEEDOR_IA: Record<string, string> = { claude: "Claude", openai: "OpenAI", gemini: "Gemini", deepseek: "DeepSeek", groq: "Groq", mistral: "Mistral", xai: "xAI", openrouter: "OpenRouter", kimi: "Kimi", qwen: "Qwen", glm: "GLM" };
/** Nombre legible del proveedor de IA que contestó ('deepseek' -> 'DeepSeek'). */
function nombreProveedorIA(id: string): string {
    return NOMBRE_PROVEEDOR_IA[id] ?? (id.charAt(0).toUpperCase() + id.slice(1));
}

const COCINERITO_IMAGE = '/images/agent/cocinerito-robot-light-v4.webp';

function CocineritoAvatar({ size = 'sm', className = '' }: { size?: 'xs' | 'sm' | 'md' | 'hero' | 'fab'; className?: string }) {
    const sizes = {
        xs: 'h-8 w-8',
        sm: 'h-12 w-11',
        md: 'h-16 w-14',
        hero: 'h-40 w-36',
        fab: 'h-20 w-20',
    };
    const fullBody = size === 'hero';
    return (
        <span className={`relative inline-flex shrink-0 items-center justify-center overflow-visible ${sizes[size]} ${className}`}>
            <Image
                src={COCINERITO_IMAGE}
                alt="Cocinerito, robot sous-chef de Foodie"
                fill
                sizes={fullBody ? '128px' : '64px'}
                className={`z-10 object-contain ${fullBody ? 'drop-shadow-[0_18px_14px_rgba(65,25,140,0.24)] drop-shadow-[0_5px_3px_rgba(15,23,42,0.24)]' : 'scale-[1.08] drop-shadow-[0_8px_6px_rgba(65,25,140,0.25)] drop-shadow-[0_2px_2px_rgba(15,23,42,0.3)]'}`}
            />
        </span>
    );
}

export function NavButtons({ json, onNavigate }: { json: string; onNavigate: (path: string) => void }) {
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

// El modelo ya no se elige aquí: lo fija HL Console (proyecto hl-servidor) en
// el agente HL_AGENTE_FOODIE. La respuesta del stream trae en `modelUsed` el
// que contestó de verdad, y solo se muestra/anota.

// La conversación se guarda por proyecto; ver src/lib/ai-chat-storage.ts.

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
    modelUsed, onClear, onMaximize, onClose,
    isMaximized, mode, suggestions, messagesEndRef,
    streamingText, streamPhase, onNavigate, onShare,
    dashboardData,
}: {
    messages: Message[];
    isLoading: boolean;
    input: string;
    setInput: (v: string) => void;
    handleSend: (e: React.FormEvent) => void;
    /** Modelo con que contestó HL en el último turno; null hasta la primera respuesta. */
    modelUsed: string | null;
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
    onShare: (content: string, question?: string) => Promise<string | null>;
    dashboardData?: any;
}) {
    const { colors } = useTheme();
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || 'es';
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

    // Exporta una respuesta del asistente a PDF de forma limpia con formato premium,
    // logos, cabeceras, gráficas (si existen) y pie de página. Carga el util en demanda.
    const [exportingIdx, setExportingIdx] = useState<number | null>(null);
    const exportMsg = async (idx: number) => {
        const msg = messages[idx];
        if (!msg || msg.role !== 'assistant' || !msg.content) return;
        setExportingIdx(idx);
        try {
            const ctx = dashboardData || getContextFromLocalStorage();
            const projectId =
                dashboardData?.project?.idProyecto ||
                dashboardData?.project?.IdProyecto ||
                (ctx as any)?.project?.idProyecto ||
                (ctx as any)?.project?.IdProyecto;

            let logo64 = '';
            let projectName = '';
            if (projectId) {
                try {
                    const resp = await fetch(`/api/project-header?projectId=${projectId}`);
                    const headerData = await resp.json();
                    if (headerData.success) {
                        logo64 = headerData.logo64 || '';
                        projectName = headerData.titulo || (ctx as any)?.project?.nombre || '';
                    }
                } catch (e) {
                    console.warn('Error fetching header for pdf logo:', e);
                }
            }

            // Capturar las gráficas de esta burbuja de mensaje si las tiene renderizadas en el DOM
            const chartImages: string[] = [];
            const el = document.getElementById(`agent-msg-${idx}`);
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
            const prev = messages[idx - 1];
            const question = prev && prev.role === 'user' ? prev.content : undefined;

            generateAnswerPDF(msg.content, {
                question,
                model: modelUsed || undefined,
                branchName: (ctx as any)?.branchName || undefined,
                projectLogo: logo64 || undefined,
                projectName: projectName || undefined,
                chartImages: chartImages.length > 0 ? chartImages : undefined,
            });
        } catch (err) {
            console.error('No se pudo generar el PDF:', err);
        } finally {
            setExportingIdx(null);
        }
    };

    // Genera una liga compartible de la respuesta y la copia al portapapeles.
    const [shareState, setShareState] = useState<{ idx: number; status: 'loading' | 'done' | 'error' } | null>(null);
    const shareMsg = async (idx: number) => {
        const msg = messages[idx];
        if (!msg || msg.role !== 'assistant' || !msg.content) return;
        const prev = messages[idx - 1];
        const question = prev && prev.role === 'user' ? prev.content : undefined;
        setShareState({ idx, status: 'loading' });
        const url = await onShare(msg.content, question);
        if (url) {
            try { await navigator.clipboard.writeText(url); } catch { /* sin permiso de clipboard */ }
            setShareState({ idx, status: 'done' });
            setTimeout(() => setShareState(s => (s?.idx === idx ? null : s)), 2500);
        } else {
            setShareState({ idx, status: 'error' });
            setTimeout(() => setShareState(s => (s?.idx === idx ? null : s)), 2500);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white">

            {/* ── Header ───────────────────────────────────────────────────── */}
            {mode === 'floating' && (
                <div className="cocinerito-chat-header shrink-0 relative overflow-visible bg-[#7033ff] text-white">

                    <div className="relative z-10 flex items-center justify-between py-3.5 pl-4 pr-16 text-white">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="relative">
                                <CocineritoAvatar size="sm" />
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white/30" style={{ backgroundColor: 'var(--color-brand-green, #34b14a)' }} />
                            </div>
                            {/* min-w-0 es lo que permite que el titulo y el modelo se
                                recorten cuando no cabe: sin el, este bloque se niega a
                                encoger y son los botones de la derecha los que se
                                salen — empezando por la X de cerrar. */}
                            <div className="min-w-0">
                                <h1 className="text-white brand-heading text-sm leading-none tracking-wider truncate">Cocinerito Foodie</h1>
                                <div className="flex items-center gap-1.5 mt-1 min-w-0">
                                    <span className="text-white/80 text-[10px] font-black flex items-center gap-1 shrink-0">
                                        <span className="w-1.5 h-1.5 rounded-full inline-block animate-ping" style={{ backgroundColor: 'var(--color-brand-green, #34b14a)', animationDuration: '2s' }} />
                                        En línea
                                    </span>
                                    {/* El modelo lo fija HL Console y puede cambiar sin tocar el
                                        código, así que se anuncia aquí y no en una constante. */}
                                    {modelUsed && (
                                        <span
                                            className="text-white/70 text-[10px] font-semibold truncate"
                                            title={`Modelo de IA en uso: ${modelUsed}`}
                                        >
                                            · {modelUsed}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* shrink-0: los botones nunca ceden espacio. Cerrar tiene que
                            estar siempre alcanzable, aunque el titulo quede a medias. */}
                        <div className="ml-2 flex shrink-0 items-center gap-1">
                            <button onClick={() => router.push(`/${locale}/dashboard/reportes/nuevo`)} title="Agente Avanzado"
                                className="hidden min-[380px]:inline-flex p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all">
                                <Sparkles size={14} />
                            </button>

                            <button onClick={() => router.push(`/${locale}/dashboard/agente/jarvis`)} title="Activar Modo Voz"
                                className="hidden min-[380px]:inline-flex p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all">
                                <Mic size={14} />
                            </button>

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
                                <button onClick={onClose} title="Cerrar chat" aria-label="Cerrar chat"
                                    className="cocinerito-chat-close absolute right-3 top-1/2 z-50 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-transparent text-white transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:opacity-60">
                                    <X size={22} strokeWidth={3} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Messages area ───────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto scroll-smooth bg-white px-5 py-5 space-y-5">

                {/* Empty state */}
                {messages.length === 0 && (
                    <div className="animate-in fade-in zoom-in-95 duration-500 pt-2">
                        <div className="max-w-sm mx-auto mb-7 text-center">
                            <div className="relative inline-flex mb-3">
                                <div className="absolute inset-x-[12%] bottom-0 h-4 rounded-full bg-violet-950/20 blur-md" />
                                <CocineritoAvatar size="hero" className="animate-float" />
                            </div>
                            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.22em] text-orange-600">Cocinerito Foodie</p>
                            <h3 className="brand-heading text-xl text-slate-900 leading-tight mb-2 tracking-wide">
                                ¿Qué cocinamos con tus números hoy?
                            </h3>
                            <p className="text-slate-500 text-xs leading-relaxed max-w-xs mx-auto font-medium">
                                Pregúntame sobre ventas, costos, inventarios o rentabilidad.
                            </p>
                        </div>

                        {/* Suggestions */}
                        <div className="space-y-2 max-w-md mx-auto">
                            <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 px-2 mb-2">
                                Sugerencias para esta sección
                            </p>
                            {suggestions.map((s, i) => (
                                <button key={i} onClick={() => sendSuggestion(s)}
                                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/80 border border-white text-slate-700 text-sm font-semibold transition-all duration-300 shadow-[0_4px_18px_-14px_rgba(15,23,42,.45)] hover:bg-white hover:border-orange-200 hover:shadow-sm hover:-translate-y-0.5 group text-left"
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
                                Potenciado por IA{modelUsed ? ` · ${modelUsed}` : ''}
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
                                <CocineritoAvatar size="xs" className="mt-0.5" />
                            )}

                            {/* Bubble */}
                            <div className={`rounded-2xl px-4 py-3.5 text-sm leading-relaxed shadow-sm transition-all duration-200 ${
                                msg.role === 'user'
                                    ? 'font-semibold hover:shadow-md'
                                    : 'border text-slate-800 rounded-tl-sm hover:shadow-md'
                            }`}
                            style={msg.role === 'user' ? {
                                backgroundColor: '#7033ff',
                                color: '#ffffff',
                                borderRadius: '20px 20px 4px 20px',
                                boxShadow: '0 5px 14px -8px rgba(112, 51, 255, 0.65)'
                            } : {
                                backgroundColor: '#ffffff',
                                borderColor: 'rgba(226, 232, 240, 0.9)',
                                boxShadow: '0 6px 20px -16px rgba(15, 23, 42, 0.45)'
                            }}>
                                {msg.role === 'assistant' ? (
                                    <div id={`agent-msg-${idx}`} className="prose prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1.5 prose-headings:font-bold prose-headings:text-slate-800 prose-headings:my-2 prose-strong:text-slate-900 prose-strong:font-black prose-table:text-xs prose-table:border-collapse prose-th:bg-slate-50 prose-th:text-slate-800 prose-th:font-bold prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-slate-200 prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-slate-100 prose-ul:my-1.5 prose-li:my-0.5 prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-code:text-xs prose-code:text-slate-700">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : msg.content}
                            </div>
                        </div>

                        {/* Acciones — solo respuestas de análisis (no aclaraciones) */}
                        {msg.role === 'assistant' && !msg.clarification && msg.content?.trim() && (
                            <div className="ml-9 flex items-center gap-1.5">
                                <button
                                    onClick={() => exportMsg(idx)}
                                    disabled={exportingIdx === idx}
                                    title="Exportar esta respuesta a PDF (con gráficas)"
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all active:scale-95 disabled:opacity-60"
                                >
                                    {exportingIdx === idx
                                        ? <><Loader2 size={12} className="animate-spin" /> Generando…</>
                                        : <><FcDocument size={14} /> Exportar PDF</>}
                                </button>
                                <button
                                    onClick={() => shareMsg(idx)}
                                    disabled={shareState?.idx === idx && shareState.status === 'loading'}
                                    title="Crear una liga para compartir (ej. por WhatsApp)"
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all active:scale-95 disabled:opacity-60"
                                >
                                    {shareState?.idx === idx && shareState.status === 'done'
                                        ? (<><Check size={12} className="text-emerald-500" /> ¡Liga copiada!</>)
                                        : shareState?.idx === idx && shareState.status === 'loading'
                                        ? (<><Link2 size={12} /> Creando…</>)
                                        : shareState?.idx === idx && shareState.status === 'error'
                                        ? (<><X size={12} className="text-red-500" /> Error</>)
                                        : (<><Link2 size={12} /> Compartir liga</>)}
                                </button>
                            </div>
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
                        <CocineritoAvatar size="xs" className="mt-0.5" />
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
                        <CocineritoAvatar size="xs" />
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
                
                <form id="agent-chat-form" onSubmit={handleSend} className="w-full">
                    <div 
                        className="flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-all duration-300 shadow-sm"
                        style={{
                            border: `1px solid ${isInputFocused ? '#7033ff' : '#e2e8f0'}`,
                            boxShadow: isInputFocused ? '0 0 0 4px rgba(112, 51, 255, 0.12)' : 'none',
                            backgroundColor: isInputFocused ? '#ffffff' : '#f8fafc'
                        }}
                    >
                        <Bot size={18} className="transition-colors duration-300" style={{ color: isInputFocused ? '#7033ff' : '#94a3b8' }} />
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
                                    backgroundColor: '#7033ff',
                                    color: '#ffffff'
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
                .cocinerito-chat-header,
                .cocinerito-chat-header :is(h1, span, button, svg) {
                    color: #ffffff !important;
                    -webkit-text-fill-color: #ffffff !important;
                }
                .cocinerito-chat-header .cocinerito-chat-close,
                .cocinerito-chat-header .cocinerito-chat-close svg {
                    color: #ffffff !important;
                    -webkit-text-fill-color: #ffffff !important;
                }
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
    const [modelUsed,     setModelUsed]     = useState<string | null>(null);
    const [hydrated,      setHydrated]      = useState(false);
    // Llave de guardado del proyecto en sesión; null = no persistir.
    const [storageKey,    setStorageKey]    = useState<string | null>(null);
    const [streamingText, setStreamingText] = useState<string | null>(null);
    const [streamPhase,   setStreamPhase]   = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    /**
     * Modelo que anuncia el encabezado antes de la primera pregunta.
     *
     * Sin esto solo se sabía después de contestar, porque el dato venía del
     * stream: preguntar "¿qué modelo usas?" obligaba a mandar un mensaje
     * primero. Lo que responda el stream pisa a esto, porque ese sí es el
     * modelo que efectivamente atendió el turno — pudo haber entrado el
     * agente de respaldo.
     */
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/ai/model', { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
                if (!data?.success) return;
                setModelUsed(prev => prev ?? `${nombreProveedorIA(data.proveedor)} · ${data.modelo}`);
            })
            .catch(() => {
                // Que no se pueda anunciar el modelo no rompe el chat.
            });
        return () => controller.abort();
    }, []);

    // ── Load persisted conversation (solo la del proyecto en sesión) ───────
    useEffect(() => {
        // Restos de la versión que guardaba sin proyecto: se van siempre, aunque
        // no haya sesión, para que no reaparezcan en el siguiente login.
        clearLegacyChatHistory();

        const idProyecto = currentProjectId();
        if (idProyecto === null) { setHydrated(true); return; }
        setStorageKey(chatStorageKey(idProyecto));

        try {
            const saved = localStorage.getItem(chatStorageKey(idProyecto));
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed.messages)) setMessages(parsed.messages);
            }
        } catch { }
        setHydrated(true);
    }, []);

    // ── Persist conversation on change ────────────────────────────────────
    useEffect(() => {
        // Sin proyecto no se guarda nada: no hay a quién pertenezca la charla.
        if (!hydrated || !storageKey) return;
        try {
            if (messages.length > 0) {
                localStorage.setItem(storageKey, JSON.stringify({ messages }));
            } else {
                localStorage.removeItem(storageKey);
            }
        } catch { }
    }, [messages, hydrated, storageKey]);

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
                            // Con proveedor y modelo (HL Console); si el servidor es anterior, solo el modelo.
                            if (evt.ia?.proveedor && evt.ia?.modelo) setModelUsed(`${nombreProveedorIA(evt.ia.proveedor)} · ${evt.ia.modelo}`);
                            else if (evt.modelUsed && evt.modelUsed !== 'none') setModelUsed(evt.modelUsed);
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
    }, [input, isLoading, messages, pathname, dashboardData]);

    const handleClear = () => {
        setMessages([]);
        if (storageKey) {
            try { localStorage.removeItem(storageKey); } catch { }
        }
    };

    // Navega a una pantalla del dashboard (desde un bloque ```nav del agente).
    const handleNavigate = useCallback((path: string) => {
        if (!path?.startsWith('/')) return;
        router.push(`/${locale}${path}`);
        setIsOpen(false); // cierra el widget flotante; en modo embedded no aplica
    }, [router, locale]);

    // Crea una liga compartible (abrible por WhatsApp) de una respuesta y
    // devuelve la URL para copiarla al portapapeles.
    const handleShare = useCallback(async (content: string, question?: string): Promise<string | null> => {
        try {
            const ctx = dashboardData || getContextFromLocalStorage();
            const projectId =
                dashboardData?.project?.idProyecto ||
                dashboardData?.project?.IdProyecto ||
                (ctx as any)?.project?.idProyecto ||
                (ctx as any)?.project?.IdProyecto;
            const res = await fetch('/api/ai/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content,
                    question,
                    projectId,
                    model: modelUsed || undefined,
                    branchName: (ctx as any)?.branchName,
                }),
            });
            const data = await res.json();
            return data?.url || null;
        } catch {
            return null;
        }
    }, [dashboardData, modelUsed]);

    const sharedProps = {
        messages, isLoading, input, setInput, handleSend,
        modelUsed, onClear: handleClear, suggestions, messagesEndRef,
        streamingText, streamPhase, onNavigate: handleNavigate, onShare: handleShare,
        dashboardData,
    };

    // ── EMBEDDED ──────────────────────────────────────────────────────────
    if (mode === 'embedded') {
        return (
            <PageShell
                title={locale === 'es' ? 'Cocinerito Foodie' : 'Foodie Chef Agent'}
                subtitle={locale === 'es' ? 'Tu chef de datos y rentabilidad en tiempo real' : 'Your real-time data and profitability chef'}
                icon={ChefHat}
                actions={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push(`/${locale}/dashboard/reportes/nuevo`)}
                            title={locale === 'es' ? 'Ir al Agente Avanzado' : 'Go to Advanced Agent'}
                            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-all active:scale-[0.98] shadow-sm"
                        >
                            <Sparkles size={13} className="text-white" />
                            <span>{locale === 'es' ? 'Agente Avanzado' : 'Advanced Agent'}</span>
                        </button>
                        <button
                            onClick={() => router.push(`/${locale}/dashboard/agente/jarvis`)}
                            title={locale === 'es' ? 'Activar Modo Voz' : 'Activate Voice Mode'}
                            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all active:scale-[0.98] shadow-sm"
                        >
                            <Mic size={13} className="text-white" />
                            <span>{locale === 'es' ? 'Modo Voz' : 'Voice Mode'}</span>
                        </button>
                        <button
                            onClick={handleClear}
                            title={locale === 'es' ? 'Nueva conversación' : 'New conversation'}
                            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-all active:scale-[0.98] shadow-sm"
                        >
                            <Trash2 size={13} className="text-gray-500" />
                            <span>{locale === 'es' ? 'Limpiar Chat' : 'Clear Chat'}</span>
                        </button>
                    </div>
                }
                className="flex-1 min-h-0 flex flex-col"
            >
                <div className="flex-1 bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden flex flex-col min-h-0">
                    <ChatPanel {...sharedProps} mode="embedded" />
                </div>
            </PageShell>
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
                    className="group relative flex h-20 w-20 items-center justify-center bg-transparent hover:scale-105 active:scale-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7033ff] focus-visible:ring-offset-4"
                    title="Abrir Cocinerito Foodie">
                    <span className="absolute inset-x-[18%] bottom-0 h-3 rounded-full bg-violet-950/25 blur-md transition-transform duration-300 group-hover:scale-110" />
                    <CocineritoAvatar size="fab" className="transition-transform duration-300 group-hover:-translate-y-1" />
                    {/* unread dot */}
                    {hasMessages && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white text-[8px] font-black text-white flex items-center justify-center">
                            {messages.filter(m => m.role === 'assistant').length > 9
                                ? '9+' : messages.filter(m => m.role === 'assistant').length || ''}
                        </span>
                    )}
                </button>
            )}

            {/* Chat window.
                En escritorio son los 400x620 de siempre. En un celular de 360-390px
                ese ancho fijo se salía de la pantalla por la izquierda y el alto no
                cabía, así que se limita a lo que de verdad hay disponible. */}
            {isOpen && (
                <div className="absolute bottom-0 right-0 rounded-3xl overflow-hidden border border-white/20 shadow-2xl transition-all duration-500 ease-out animate-in slide-in-from-bottom-4 zoom-in-95 w-[calc(100vw-3rem)] max-w-[400px] h-[620px] max-h-[calc(100vh-7rem)]"
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
