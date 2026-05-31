'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { Sparkles, Trash2, Maximize2, Minimize2, X, Send, Bot, ChevronRight } from 'lucide-react';

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
    return (
        <div className="flex items-center gap-1 px-1 py-0.5">
            {[0, 1, 2].map(i => (
                <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-indigo-400"
                    style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
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
}) {
    const currentModelInfo = CLAUDE_MODELS.find(m => m.id === model) ?? CLAUDE_MODELS[0];

    const sendSuggestion = (text: string) => {
        setInput(text);
        setTimeout(() => {
            (document.getElementById('agent-chat-form') as HTMLFormElement)?.requestSubmit();
        }, 0);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: '#f8f9fd' }}>

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="shrink-0 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)' }}>
                {/* decorative circles */}
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5" />
                <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5" />

                <div className="relative px-4 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="relative">
                            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-xl shadow-lg">
                                👨‍🍳
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white/30" />
                        </div>
                        <div>
                            <p className="text-white font-bold text-sm leading-tight">Agente Foodie Guru</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-white/60 text-[10px] font-medium">
                                    {currentModelInfo.badge} {currentModelInfo.label}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/30" />
                                <span className="text-emerald-300 text-[10px] font-bold">En línea</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Model picker */}
                        <select
                            value={model}
                            onChange={e => setModel(e.target.value as ClaudeModel)}
                            className="text-[10px] font-bold bg-white/10 border border-white/20 text-white rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-white/20 transition-all"
                        >
                            {CLAUDE_MODELS.map(m => (
                                <option key={m.id} value={m.id} className="text-slate-800 bg-white">
                                    {m.badge} {m.label}
                                </option>
                            ))}
                        </select>

                        <button onClick={onClear} title="Nueva conversación"
                            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all">
                            <Trash2 size={14} />
                        </button>

                        {onMaximize && (
                            <button onClick={onMaximize} title={isMaximized ? 'Restaurar' : 'Maximizar'}
                                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all">
                                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>
                        )}

                        {onClose && (
                            <button onClick={onClose} title="Cerrar"
                                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Messages area ─────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto scroll-smooth px-4 py-4 space-y-5">

                {/* Empty state */}
                {messages.length === 0 && (
                    <div className="animate-in fade-in zoom-in-95 duration-500 pt-4">
                        {/* Hero */}
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 shadow-lg"
                                style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
                                <span className="text-4xl">👨‍🍳</span>
                            </div>
                            <h3 className="font-black text-slate-800 text-base">"Tu éxito se cocina aquí"</h3>
                            <p className="text-slate-500 text-xs mt-2 leading-relaxed max-w-xs mx-auto">
                                Soy tu consultor de rentabilidad restaurantera con acceso en tiempo real a tus datos.
                                Pregúntame cualquier cosa.
                            </p>
                        </div>

                        {/* Suggestions */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1 mb-2">
                                Sugerencias para esta sección
                            </p>
                            {suggestions.map((s, i) => (
                                <button key={i} onClick={() => sendSuggestion(s)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/60 text-slate-700 hover:text-indigo-700 text-sm font-medium transition-all duration-150 shadow-sm hover:shadow-md group text-left">
                                    <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
                                    {s}
                                </button>
                            ))}
                        </div>

                        {/* Info pill */}
                        <div className="flex items-center justify-center gap-2 mt-6">
                            <Sparkles size={11} className="text-indigo-400" />
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
                                <div className="w-7 h-7 rounded-xl shrink-0 mt-0.5 flex items-center justify-center text-sm shadow-sm"
                                    style={{ background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)' }}>
                                    👨‍🍳
                                </div>
                            )}

                            {/* Bubble */}
                            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                                msg.role === 'user'
                                    ? 'text-white rounded-tr-sm font-medium'
                                    : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                            }`}
                            style={msg.role === 'user' ? {
                                background: 'linear-gradient(135deg, #4f46e5, #6d28d9)',
                            } : {}}>
                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1.5 prose-headings:font-bold prose-headings:text-slate-800 prose-headings:my-2 prose-strong:text-indigo-700 prose-strong:font-bold prose-table:text-xs prose-table:border-collapse prose-th:bg-indigo-50 prose-th:text-indigo-800 prose-th:font-bold prose-th:px-3 prose-th:py-2 prose-th:border prose-th:border-indigo-100 prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-slate-100 prose-ul:my-1.5 prose-li:my-0.5 prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-code:text-xs prose-code:text-indigo-700">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : msg.content}
                            </div>
                        </div>

                        {/* Clarification chips */}
                        {msg.role === 'assistant' && msg.clarification?.suggestions && (
                            <div className="ml-9 flex flex-wrap gap-2">
                                {msg.clarification.suggestions.map((s, si) => (
                                    <button key={si} onClick={() => sendSuggestion(s)}
                                        className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95"
                                        style={{ borderColor: '#c7d2fe', background: '#eef2ff', color: '#4338ca' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e0e7ff'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#eef2ff'; }}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* Loading */}
                {isLoading && (
                    <div className="flex items-start gap-2.5 animate-in fade-in duration-300">
                        <div className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-sm shadow-sm"
                            style={{ background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)' }}>
                            👨‍🍳
                        </div>
                        <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                            <TypingIndicator />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* ── Input ─────────────────────────────────────────────────────── */}
            <div className="shrink-0 px-4 pb-4 pt-2 bg-white/80 backdrop-blur-sm border-t border-slate-100">
                <form id="agent-chat-form" onSubmit={handleSend}>
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm focus-within:border-indigo-400 focus-within:shadow-md focus-within:shadow-indigo-100/50 transition-all">
                        <Bot size={16} className="text-slate-300 shrink-0" />
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Pregunta sobre tu negocio..."
                            className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none font-medium min-w-0"
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || !input.trim()}
                            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={!isLoading && input.trim()
                                ? { background: 'linear-gradient(135deg, #4f46e5, #6d28d9)', color: 'white' }
                                : { background: '#f1f5f9', color: '#94a3b8' }}>
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

    const [isOpen,      setIsOpen]      = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [messages,    setMessages]    = useState<Message[]>([]);
    const [input,       setInput]       = useState('');
    const [isLoading,   setIsLoading]   = useState(false);
    const [model,       setModel]       = useState<ClaudeModel>('claude-sonnet-4-6');
    const [hydrated,    setHydrated]    = useState(false);
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
    }, [messages, isOpen, isMaximized]);

    const suggestions = getPageSuggestions(pathname || '');

    const handleSend = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: input, ts: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const ctx = dashboardData || getContextFromLocalStorage();
            const projectId =
                dashboardData?.project?.idProyecto ||
                dashboardData?.project?.IdProyecto ||
                (ctx as any)?.project?.idProyecto  ||
                (ctx as any)?.project?.IdProyecto;

            const res  = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
                    model,
                    context: { ...ctx, currentPage: pathname },
                    projectId,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (data.executedSql) {
                console.groupCollapsed('🔍 Foodie Guru – SQL');
                console.log(data.executedSql);
                console.groupEnd();
            }

            if (data.clarification) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.clarification.question,
                    clarification: data.clarification,
                    ts: Date.now(),
                }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: data.content, ts: Date.now() }]);
            }
        } catch (err: any) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Lo siento, ocurrió un error: ${err.message}`,
                ts: Date.now(),
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, messages, model, pathname, dashboardData]);

    const handleClear = () => {
        setMessages([]);
        localStorage.removeItem(CHAT_STORAGE_KEY);
    };

    const sharedProps = {
        messages, isLoading, input, setInput, handleSend,
        model, setModel, onClear: handleClear, suggestions, messagesEndRef,
    };

    // ── EMBEDDED ──────────────────────────────────────────────────────────
    if (mode === 'embedded') {
        return (
            <div className="h-full w-full rounded-2xl overflow-hidden shadow-xl border border-slate-200/80">
                <ChatPanel {...sharedProps} mode="embedded" />
            </div>
        );
    }

    // ── FLOATING ──────────────────────────────────────────────────────────
    const hasMessages = messages.length > 0;

    return (
        <div className="fixed bottom-6 right-6 z-[99999]">
            {/* FAB button */}
            {!isOpen && (
                <button onClick={() => setIsOpen(true)}
                    className="group relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300"
                    style={{ background: 'linear-gradient(135deg, #4f46e5, #6d28d9)' }}
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
                    <span className="absolute inset-0 rounded-2xl ring-4 ring-indigo-300/40 animate-ping" style={{ animationDuration: '3s' }} />
                </button>
            )}

            {/* Chat window */}
            {isOpen && (
                <div className={`absolute bottom-0 right-0 rounded-3xl overflow-hidden border border-white/20 shadow-2xl transition-all duration-500 ease-out animate-in slide-in-from-bottom-4 zoom-in-95 ${
                    isMaximized
                        ? 'w-[82vw] h-[88vh] max-w-5xl'
                        : 'w-[400px] h-[620px]'
                }`}
                style={{ boxShadow: '0 32px 64px -12px rgba(79,70,229,0.25), 0 0 0 1px rgba(255,255,255,0.1)' }}>
                    <ChatPanel
                        {...sharedProps}
                        onMaximize={() => setIsMaximized(v => !v)}
                        onClose={() => { setIsOpen(false); setIsMaximized(false); }}
                        isMaximized={isMaximized}
                        mode="floating"
                    />
                </div>
            )}
        </div>
    );
}
