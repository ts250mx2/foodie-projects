'use client';

import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Lightbulb, Table2, BarChart3, LineChart, PieChart, Gauge, FileText, FileSpreadsheet } from 'lucide-react';
import AgentChart from '@/components/dashboard/AgentChart';

interface ReportColumn { key: string; label?: string; role: string; format?: string }
interface ReportDefinition {
    title: string;
    description?: string;
    visualization: 'table' | 'bar' | 'line' | 'pie' | 'kpi';
    expectedColumns: ReportColumn[];
    insights: string[];
}

type Viz = 'table' | 'bar' | 'line' | 'pie' | 'kpi';

function fmtValue(v: any, format?: string): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') {
        if (format === 'currency') return '$' + v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (format === 'percent') return v.toLocaleString('es-MX', { maximumFractionDigits: 1 }) + '%';
        return v.toLocaleString('es-MX');
    }
    return String(v);
}

function slugify(s: string): string {
    return (s || 'reporte').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'reporte';
}
function downloadBlob(content: BlobPart, mime: string, filename: string) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
}
function csvCell(v: any): string {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const VIZ_OPTS: { id: Viz; label: string; icon: any }[] = [
    { id: 'kpi', label: 'KPIs', icon: Gauge },
    { id: 'table', label: 'Tabla', icon: Table2 },
    { id: 'bar', label: 'Barras', icon: BarChart3 },
    { id: 'line', label: 'Línea', icon: LineChart },
    { id: 'pie', label: 'Pastel', icon: PieChart },
];

export default function ReportViewer({ definition, rows }: { definition: ReportDefinition; rows: any[] }) {
    const [viz, setViz] = useState<Viz>(definition.visualization || 'table');
    const [exporting, setExporting] = useState(false);

    const cols: ReportColumn[] = definition.expectedColumns?.length
        ? definition.expectedColumns
        : (rows[0]
            ? Object.keys(rows[0]).map(k => ({ key: k, role: (typeof rows[0][k] === 'number' ? 'measure' : 'dimension') as ReportColumn['role'] }))
            : []);

    const dim = cols.find(c => c.role === 'dimension' || c.role === 'temporal') || cols[0];
    const measures = cols.filter(c => c.role === 'measure');
    const fmtOf = (k: string) => cols.find(c => c.key === k)?.format;

    const canChart = !!dim && measures.length > 0 && rows.length > 0;
    const canKpi = measures.length > 0 && rows.length > 0;
    const isEnabled = (v: Viz) => v === 'table' || (v === 'kpi' ? canKpi : canChart);
    const effectiveViz: Viz = isEnabled(viz) ? viz : 'table';

    const chartSpec = useMemo(() => {
        if (!canChart || !['bar', 'line', 'pie'].includes(effectiveViz)) return null;
        const m1 = measures[0].key;
        const m2 = measures[1]?.key;
        return {
            type: effectiveViz,
            title: definition.title,
            format: fmtOf(m1) === 'currency' ? 'currency' : fmtOf(m1) === 'percent' ? 'percent' : 'number',
            seriesLabels: m2 ? [measures[0].label || m1, measures[1].label || m2] : undefined,
            data: rows.slice(0, 30).map(r => ({
                name: String(r[dim.key] ?? ''),
                value: Number(r[m1]) || 0,
                ...(m2 ? { value2: Number(r[m2]) || 0 } : {}),
            })),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canChart, effectiveViz, rows, definition.title]);

    const exportCsv = () => {
        const header = cols.map(c => csvCell(c.label || c.key)).join(',');
        const body = rows.map(r => cols.map(c => csvCell(r[c.key])).join(','));
        downloadBlob('﻿' + [header, ...body].join('\r\n'), 'text/csv;charset=utf-8', `${slugify(definition.title)}.csv`);
    };

    const exportPdf = async () => {
        setExporting(true);
        try {
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;
            const doc = new jsPDF();
            doc.setFontSize(15); doc.setTextColor(20);
            doc.text(definition.title, 14, 16);
            let y = 22;
            if (definition.description) {
                doc.setFontSize(10); doc.setTextColor(120);
                const lines = doc.splitTextToSize(definition.description, 180);
                doc.text(lines, 14, y); y += lines.length * 5 + 2;
            }
            autoTable(doc, {
                startY: y,
                head: [cols.map(c => c.label || c.key)],
                body: rows.map(r => cols.map(c => fmtValue(r[c.key], c.format))),
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [244, 72, 30], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [250, 248, 246] },
            });
            doc.save(`${slugify(definition.title)}.pdf`);
        } finally { setExporting(false); }
    };

    return (
        <div className="space-y-4">
            {definition.description && (
                <p className="text-sm text-slate-500 -mt-1">{definition.description}</p>
            )}

            {/* Toolbar: selector de visualización + exportar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                    {VIZ_OPTS.map(opt => {
                        const Icon = opt.icon;
                        const disabled = !isEnabled(opt.id);
                        const active = effectiveViz === opt.id;
                        return (
                            <button key={opt.id} onClick={() => setViz(opt.id)} disabled={disabled}
                                title={disabled ? (opt.id === 'kpi' ? 'Requiere al menos una medida' : 'Requiere una dimensión y una medida') : opt.label}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${active ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Icon size={14} /> {opt.label}
                            </button>
                        );
                    })}
                </div>
                <div className="inline-flex items-center gap-2">
                    <button onClick={exportCsv} disabled={rows.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-40">
                        <FileSpreadsheet size={14} /> CSV
                    </button>
                    <button onClick={exportPdf} disabled={rows.length === 0 || exporting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-40">
                        <FileText size={14} /> {exporting ? 'Generando…' : 'PDF'}
                    </button>
                </div>
            </div>

            {/* KPIs (tarjetas de número único) */}
            {effectiveViz === 'kpi' && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {measures.map(m => (
                        <div key={m.key} className="relative bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-hidden">
                            <span className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: 'var(--color-brand-orange, #f4481e)' }} />
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 truncate">{m.label || m.key}</p>
                            <p className="text-2xl font-black text-slate-800 mt-1.5 tabular-nums">{fmtValue(rows[0]?.[m.key], m.format)}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Gráfica */}
            {chartSpec && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
                    <AgentChart json={JSON.stringify(chartSpec)} />
                </div>
            )}

            {/* Insights */}
            {definition.insights?.length > 0 && (
                <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-4">
                    <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-amber-700 mb-2">
                        <Lightbulb size={14} /> Hallazgos
                    </p>
                    <div className="space-y-2">
                        {definition.insights.map((ins, i) => (
                            <div key={i} className="prose prose-sm max-w-none text-slate-700 prose-strong:text-slate-900 prose-strong:font-black">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{`• ${ins}`}</ReactMarkdown>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabla (siempre, debajo de la gráfica) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                {cols.map(c => (
                                    <th key={c.key} className="text-left font-bold text-slate-700 px-4 py-2.5 whitespace-nowrap">
                                        {c.label || c.key}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, ri) => (
                                <tr key={ri} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                                    {cols.map(c => (
                                        <td key={c.key} className={`px-4 py-2 whitespace-nowrap ${c.role === 'measure' ? 'text-right tabular-nums text-slate-800 font-semibold' : 'text-slate-600'}`}>
                                            {fmtValue(r[c.key], c.format)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {rows.length === 0 && <div className="text-center text-slate-400 py-10 text-sm">El reporte no devolvió filas.</div>}
            </div>
        </div>
    );
}
