'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Check, Database, AlertTriangle, Maximize2, Minimize2, Eraser, Terminal, FileBarChart } from 'lucide-react';

const SUGGESTIONS = [
    'Indicadores clave del mes: ventas, gastos, utilidad y ticket promedio',
    'Top 10 gastos del mes por concepto, de mayor a menor',
    'Ventas por canal de venta de este mes, con su comisión',
    'Compras por proveedor del mes pasado',
    'Nómina por empleado del mes, de mayor a menor',
    'Ventas por día del mes para ver la tendencia',
];
const MODELS = [
    { id: 'claude-sonnet-4-6', label: '⚡ Sonnet 4.6' },
    { id: 'claude-opus-4-8', label: '🧠 Opus 4.8' },
    { id: 'claude-haiku-4-5-20251001', label: '🪶 Haiku 4.5' },
];

type Entry =
    | { kind: 'user'; text: string }
    | { kind: 'status'; label: string }
    | { kind: 'query'; area?: string; rows?: number }
    | { kind: 'report'; idReporte: number; title: string; description?: string }
    | { kind: 'error'; message: string };

function getProjectId(): number | null {
    try { const p = JSON.parse(localStorage.getItem('project') || '{}'); return p.idProyecto || p.IdProyecto || null; }
    catch { return null; }
}

export default function AgenteAvanzadoConsole() {
    const params = useParams();
    const locale = (params?.locale as string) || 'es';
    const [entries, setEntries] = useState<Entry[]>([]);
    const [input, setInput] = useState('');
    const [model, setModel] = useState('claude-sonnet-4-6');
    const [busy, setBusy] = useState(false);
    const [maximized, setMaximized] = useState(false);
    const [projectId, setProjectId] = useState<number | null>(null);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setProjectId(getProjectId()); }, []);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [entries, busy]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMaximized(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const push = (e: Entry) => setEntries(prev => [...prev, e]);

    const run = async (text?: string) => {
        const p = (text ?? input).trim();
        if (!p || busy) return;
        const pid = projectId ?? getProjectId();
        if (!pid) { push({ kind: 'error', message: 'No se detectó un proyecto activo. Selecciona tu proyecto.' }); return; }

        push({ kind: 'user', text: p });
        setInput('');
        setBusy(true);
        try {
            const res = await fetch('/api/reports/build?stream=true', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: pid, prompt: p, model }),
            });
            if (!res.ok || !res.body) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.detail || j.error || 'No se pudo conectar con el agente.');
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let stop = false;
            while (!stop) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const frames = buffer.split('\n\n');
                buffer = frames.pop() || '';
                for (const frame of frames) {
                    const line = frame.split('\n').find(l => l.startsWith('data:'));
                    if (!line) continue;
                    let evt: any;
                    try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
                    if (evt.type === 'status') push({ kind: 'status', label: evt.label });
                    else if (evt.type === 'step') push({ kind: 'query', area: evt.area, rows: evt.rows });
                    else if (evt.type === 'done') { push({ kind: 'report', idReporte: evt.idReporte, title: evt.title, description: evt.description }); stop = true; }
                    else if (evt.type === 'error') { push({ kind: 'error', message: evt.detail || evt.message || 'Error' }); stop = true; }
                }
            }
        } catch (e: any) {
            push({ kind: 'error', message: e?.message || 'Error creando el reporte' });
        } finally {
            setBusy(false);
        }
    };

    const lastStatusIdx = (() => { for (let i = entries.length - 1; i >= 0; i--) if (entries[i].kind === 'status') return i; return -1; })();

    return (
        <div className={`flex flex-col bg-white text-slate-800 font-mono text-[13px] overflow-hidden ${maximized ? 'fixed inset-0 z-[60]' : 'h-full w-full'}`}>
            {/* Header */}
            <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-white border-b border-slate-200">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--color-brand-yellow, #f8e14c)' }}>
                    <Terminal size={15} style={{ color: '#0a0a0a' }} />
                </span>
                <span className="text-sm font-black tracking-tight text-slate-800">Agente Avanzado · Consola</span>
                <div className="flex-1" />
                <button onClick={() => setEntries([])} title="Limpiar consola"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
                    <Eraser size={13} /> Limpiar
                </button>
                <Link href={`/${locale}/dashboard/reportes`} className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors" style={{ color: 'var(--color-brand-orange, #f4481e)' }}>Mis Reportes →</Link>
                <button onClick={() => setMaximized(m => !m)} title={maximized ? 'Restaurar (Esc)' : 'Maximizar'}
                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                    {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
            </div>

            {/* Barra de carga */}
            {busy && <div className="h-[2px] shrink-0 animate-pulse" style={{ backgroundColor: 'var(--color-brand-orange, #f4481e)' }} />}

            {/* Logs */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 leading-relaxed" style={{ background: '#fcfbfa' }}>
                {entries.length === 0 && !busy && (
                    <div className="space-y-3 py-4 max-w-2xl">
                        <p className="text-slate-500">Describe el reporte que quieres y lo construyo paso a paso (sin que veas el SQL).</p>
                        <div className="space-y-1.5">
                            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Sugerencias</p>
                            {SUGGESTIONS.map((s, i) => (
                                <button key={i} onClick={() => run(s)}
                                    className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-orange-300 hover:shadow-sm text-[12px] transition-all">
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {entries.map((e, i) => {
                    if (e.kind === 'user') return (
                        <div key={i} className="flex items-start gap-2 pt-2">
                            <span className="select-none font-black" style={{ color: 'var(--color-brand-orange, #f4481e)' }}>$</span>
                            <span className="font-bold text-slate-900 break-words">{e.text}</span>
                        </div>
                    );
                    if (e.kind === 'status') {
                        const active = busy && i === lastStatusIdx;
                        return (
                            <div key={i} className="flex items-center gap-2 text-slate-500 pl-4">
                                {active ? <Loader2 size={13} className="animate-spin shrink-0" style={{ color: 'var(--color-brand-orange, #f4481e)' }} /> : <Check size={13} className="text-emerald-500 shrink-0" />}
                                <span>{e.label}</span>
                            </div>
                        );
                    }
                    if (e.kind === 'query') return (
                        <div key={i} className="pl-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-[12px] font-bold">
                                <Database size={12} /> Consulta construida{e.area ? ` · ${e.area}` : ''}
                                {typeof e.rows === 'number' && <span className="text-orange-400 font-semibold">({e.rows} filas)</span>}
                            </span>
                        </div>
                    );
                    if (e.kind === 'error') return (
                        <div key={i} className="flex items-start gap-2 text-red-600 pl-4 pt-1">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span className="break-words">{e.message}</span>
                        </div>
                    );
                    // report
                    return (
                        <div key={i} className="pl-4 pt-1">
                            <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-1.5 text-emerald-600 text-[11px] font-black tracking-wider mb-1">
                                    <Check size={14} /> REPORTE LISTO
                                </div>
                                <p className="font-black text-slate-800 text-[15px] leading-tight">{e.title}</p>
                                {e.description && <p className="text-[12px] text-slate-500 mt-1">{e.description}</p>}
                                <Link href={`/${locale}/dashboard/reportes/${e.idReporte}`}
                                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-[13px] font-bold transition-all active:scale-[0.98] shadow-sm"
                                    style={{ backgroundColor: 'var(--color-brand-orange, #f4481e)' }}>
                                    <FileBarChart size={14} /> Abrir reporte →
                                </Link>
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>

            {/* Input estilo consola */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
                {!projectId && (
                    <div className="mb-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                        No se detectó un proyecto activo. Selecciona tu proyecto para crear reportes.
                    </div>
                )}
                <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 focus-within:border-orange-300 transition-colors">
                    <span className="pt-2 select-none font-black" style={{ color: 'var(--color-brand-orange, #f4481e)' }}>$</span>
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } }}
                        disabled={busy}
                        rows={1}
                        placeholder='Ej: "top 10 gastos del mes por concepto"'
                        className="flex-1 bg-transparent resize-none outline-none text-slate-800 placeholder:text-slate-400 disabled:opacity-50 py-1.5 max-h-32 min-w-0"
                    />
                    <button onClick={() => run()} disabled={busy || !input.trim()}
                        className="px-4 py-1.5 rounded-lg text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 inline-flex items-center gap-1.5 shadow-sm"
                        style={{ backgroundColor: 'var(--color-brand-orange, #f4481e)' }}>
                        {busy ? <Loader2 size={14} className="animate-spin" /> : null} Enviar
                    </button>
                </div>
                <div className="flex items-center justify-between gap-3 mt-1.5 flex-wrap">
                    <p className="text-[11px] text-slate-400">Enter envía · Shift+Enter salto · el agente diseña la consulta y los hallazgos</p>
                    <label className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                        Modelo:
                        <select value={model} onChange={e => setModel(e.target.value)} disabled={busy}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 outline-none focus:border-orange-300 cursor-pointer">
                            {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                    </label>
                </div>
            </div>
        </div>
    );
}
