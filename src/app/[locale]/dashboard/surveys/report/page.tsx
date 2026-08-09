'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    BarChart3,
    Star,
    MessageCircle,
    Mail,
    ClipboardList,
    TabletSmartphone,
    Download,
    Eye,
} from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';
import PageShell, { StatsGrid, StatCard } from '@/components/PageShell';
import Button from '@/components/Button';
import BaseModal from '@/components/BaseModal';
import ThemedGridHeader, {
    ThemedGridHeaderCell,
    TableBody,
    TableRow,
    TableCell,
    RowActionButton,
} from '@/components/ThemedGridHeader';
import { useModuleColor } from '@/lib/use-module-color';
import SurveyLinkModal from '@/components/surveys/SurveyLinkModal';

/**
 * Reporteador de encuestas: resumen del periodo, promedio y distribución por
 * pregunta, y las respuestas individuales con comentario y correo.
 */

interface ReportSummary {
    totalRespuestas: number;
    promedioGeneral: number | null;
    totalComentarios: number;
    totalCorreos: number;
    totalOptIn: number;
}

interface ReportQuestion {
    idPregunta: number;
    pregunta: string;
    tipo: 'estrellas' | 'opciones';
    total: number;
    promedio: number | null;
    distribucion: { valor: number; total: number; etiqueta: string | null }[];
}

interface ReportResponseDetail {
    pregunta: string;
    tipo: 'estrellas' | 'opciones';
    valor: number;
    etiqueta: string | null;
}

interface ReportResponse {
    idRespuesta: number;
    fecha: string;
    sucursal: string | null;
    correo: string | null;
    aceptaPromos: boolean;
    comentario: string | null;
    detalle: ReportResponseDetail[];
}

interface ReportBranch {
    IdSucursal: number;
    Sucursal: string;
}

const FALLBACK_MODULE_COLOR = '#6d28d9';
const STAR_FILL = '#f59e0b';

const toIso = (d: Date) => d.toISOString().slice(0, 10);

function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
        + ' ' + date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function averageOf(detalle: ReportResponseDetail[]): number | null {
    if (detalle.length === 0) return null;
    return detalle.reduce((sum, d) => sum + d.valor, 0) / detalle.length;
}

/** Estrellitas de solo lectura para promedios (redondeo a la más cercana). */
function StarRow({ value, size = 14 }: { value: number; size?: number }) {
    const rounded = Math.round(value);
    return (
        <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} de 5`}>
            {Array.from({ length: 5 }, (_, i) => (
                <Star
                    key={i}
                    size={size}
                    fill={i < rounded ? STAR_FILL : 'none'}
                    color={i < rounded ? STAR_FILL : '#d1d5db'}
                    strokeWidth={1.8}
                />
            ))}
        </span>
    );
}

export default function SurveyReportPage() {
    const moduleColor = useModuleColor() ?? FALLBACK_MODULE_COLOR;
    const projectId = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('project') || '{}').idProyecto
        : null;

    const today = useMemo(() => new Date(), []);
    const [startDate, setStartDate] = useState(() => toIso(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
    const [endDate, setEndDate] = useState(() => toIso(today));
    const [branchFilter, setBranchFilter] = useState(0);

    const [summary, setSummary] = useState<ReportSummary | null>(null);
    const [questions, setQuestions] = useState<ReportQuestion[]>([]);
    const [responses, setResponses] = useState<ReportResponse[]>([]);
    const [branches, setBranches] = useState<ReportBranch[]>([]);
    const [isTruncated, setIsTruncated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLinkOpen, setIsLinkOpen] = useState(false);
    const [viewing, setViewing] = useState<ReportResponse | null>(null);

    const fetchReport = useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ projectId: String(projectId), startDate, endDate });
            if (branchFilter > 0) params.set('idSucursal', String(branchFilter));
            const res = await fetch(`/api/surveys/report?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setSummary(data.summary);
                setQuestions(data.questions || []);
                setResponses(data.responses || []);
                setBranches(data.branches || []);
                setIsTruncated(Boolean(data.truncated));
            }
        } catch (error) {
            console.error('Error fetching survey report:', error);
        } finally {
            setIsLoading(false);
        }
    }, [projectId, startDate, endDate, branchFilter]);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    const chartData = useMemo(() => questions.map((q, index) => ({
        name: `P${index + 1}`,
        pregunta: q.pregunta,
        promedio: q.promedio != null ? Number(q.promedio.toFixed(2)) : 0,
    })), [questions]);

    const handleExportCsv = () => {
        if (responses.length === 0) return;
        const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const header = ['Fecha', 'Sucursal', 'Promedio', 'Correo', 'AceptaPromos', 'Comentario', 'Respuestas'];
        const rows = responses.map(r => [
            formatDate(r.fecha),
            r.sucursal || '',
            averageOf(r.detalle)?.toFixed(2) ?? '',
            r.correo || '',
            r.aceptaPromos ? 'Sí' : 'No',
            r.comentario || '',
            r.detalle.map(d => `${d.pregunta}: ${d.valor}${d.etiqueta ? ` (${d.etiqueta})` : ''}`).join(' | '),
        ].map(escape).join(','));
        // BOM para que Excel abra el acento bien.
        const csv = '﻿' + [header.map(escape).join(','), ...rows].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `encuestas_${startDate}_${endDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <PageShell
            title="Reporte de Encuestas"
            subtitle="Lo que tus comensales opinan de la experiencia"
            icon={BarChart3}
            actions={
                <>
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Del</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/30 shadow-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Al</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/30 shadow-sm"
                            />
                        </div>
                        {branches.length > 1 && (
                            <div className="flex flex-col gap-0.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sucursal</label>
                                <select
                                    value={branchFilter}
                                    onChange={e => setBranchFilter(Number(e.target.value))}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/30 shadow-sm"
                                >
                                    <option value={0}>Todas</option>
                                    {branches.map(b => (
                                        <option key={b.IdSucursal} value={b.IdSucursal}>{b.Sucursal}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <Button variant="secondary" size="md" leftIcon={Download} onClick={handleExportCsv} disabled={responses.length === 0}>
                        CSV
                    </Button>
                    <Button variant="solid" size="md" leftIcon={TabletSmartphone} iconBox onClick={() => setIsLinkOpen(true)}>
                        Liga para Tablet
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                {/* Resumen */}
                <StatsGrid cols={4}>
                    <StatCard
                        label="Respuestas"
                        value={summary?.totalRespuestas ?? '—'}
                        icon={ClipboardList}
                        color={moduleColor}
                    />
                    <StatCard
                        label="Promedio general"
                        value={summary?.promedioGeneral != null ? `${summary.promedioGeneral.toFixed(1)} / 5` : '—'}
                        icon={Star}
                        color={STAR_FILL}
                    />
                    <StatCard
                        label="Comentarios"
                        value={summary?.totalComentarios ?? '—'}
                        icon={MessageCircle}
                        color="#0369a1"
                    />
                    <StatCard
                        label="Correos captados"
                        value={summary?.totalCorreos ?? '—'}
                        icon={Mail}
                        trend={summary && summary.totalOptIn > 0 ? 'up' : undefined}
                        trendLabel={summary && summary.totalOptIn > 0 ? `${summary.totalOptIn} aceptan promos` : undefined}
                        color="#10b981"
                    />
                </StatsGrid>

                {/* Promedio por pregunta */}
                {questions.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Promedio por pregunta</p>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                                <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: '#64748b' }} width={28} />
                                <Tooltip
                                    formatter={(value) => [`${value} / 5`, 'Promedio']}
                                    labelFormatter={(label) => chartData.find(d => d.name === label)?.pregunta ?? label}
                                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', maxWidth: 280 }}
                                />
                                <Bar dataKey="promedio" fill={moduleColor} radius={[4, 4, 0, 0]} maxBarSize={48} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Distribución por pregunta */}
                {questions.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {questions.map((question, index) => {
                            const maxCount = Math.max(1, ...question.distribucion.map(d => d.total));
                            return (
                                <div key={question.idPregunta} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-sm font-semibold text-gray-800 leading-snug">
                                            <span className="text-gray-400 font-bold mr-1.5">P{index + 1}</span>
                                            {question.pregunta}
                                        </p>
                                        <div className="flex flex-col items-end shrink-0">
                                            {question.promedio != null && <StarRow value={question.promedio} />}
                                            <span className="text-xs font-bold text-gray-600 tabular-nums mt-0.5">
                                                {question.promedio != null ? question.promedio.toFixed(1) : '—'} · {question.total} resp.
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        {[...question.distribucion].reverse().map(d => {
                                            const pct = question.total > 0 ? Math.round((d.total / question.total) * 100) : 0;
                                            return (
                                                <div key={d.valor} className="flex items-center gap-2">
                                                    <span className="w-28 text-[11px] font-medium text-gray-500 truncate text-right">
                                                        {d.etiqueta || (question.tipo === 'estrellas' ? `${d.valor} ★` : d.valor)}
                                                    </span>
                                                    <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full"
                                                            style={{ width: `${(d.total / maxCount) * 100}%`, backgroundColor: moduleColor }}
                                                        />
                                                    </div>
                                                    <span className="w-14 text-[11px] font-semibold text-gray-600 tabular-nums">
                                                        {d.total} · {pct}%
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Respuestas individuales */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
                        <table className="min-w-full border-collapse">
                            <ThemedGridHeader accentColor={moduleColor}>
                                <ThemedGridHeaderCell>Fecha</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>Sucursal</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="center">Calificación</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>Correo</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>Comentario</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="right">Ver</ThemedGridHeaderCell>
                            </ThemedGridHeader>
                            <TableBody
                                loading={isLoading}
                                empty={!isLoading && responses.length === 0}
                                emptyMessage="Sin respuestas en el periodo seleccionado"
                                colSpan={6}
                            >
                                {responses.map(response => {
                                    const avg = averageOf(response.detalle);
                                    return (
                                        <TableRow key={response.idRespuesta} onClick={() => setViewing(response)}>
                                            <TableCell>{formatDate(response.fecha)}</TableCell>
                                            <TableCell muted>{response.sucursal || '—'}</TableCell>
                                            <TableCell align="center">
                                                {avg != null ? (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <StarRow value={avg} size={12} />
                                                        <span className="font-semibold text-gray-700 tabular-nums">{avg.toFixed(1)}</span>
                                                    </span>
                                                ) : '—'}
                                            </TableCell>
                                            <TableCell muted>
                                                {response.correo || '—'}
                                                {response.aceptaPromos && (
                                                    <span className="ml-1.5 text-[10px] font-bold text-emerald-600 uppercase">promos</span>
                                                )}
                                            </TableCell>
                                            <TableCell muted className="max-w-[280px]">
                                                <span className="block truncate">{response.comentario || '—'}</span>
                                            </TableCell>
                                            <TableCell align="right">
                                                <RowActionButton
                                                    icon={Eye}
                                                    label="Ver detalle"
                                                    variant="view"
                                                    onClick={(e) => { e.stopPropagation(); setViewing(response); }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </table>
                    </div>
                    {!isLoading && responses.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <span className="text-xs text-gray-400">
                                {responses.length} respuesta{responses.length === 1 ? '' : 's'} en el periodo
                                {isTruncated && ' (se muestran las 500 más recientes)'}
                            </span>
                            <span className="text-xs font-semibold text-gray-600">
                                {summary?.totalComentarios ?? 0} con comentario
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Detalle de una respuesta */}
            <BaseModal
                isOpen={viewing !== null}
                onClose={() => setViewing(null)}
                title="Detalle de la Respuesta"
                subtitle={viewing ? `${formatDate(viewing.fecha)}${viewing.sucursal ? ` · ${viewing.sucursal}` : ''}` : undefined}
                size="md"
                accentColor={moduleColor}
                footer={
                    <div className="flex justify-end">
                        <Button variant="secondary" size="md" onClick={() => setViewing(null)}>Cerrar</Button>
                    </div>
                }
            >
                {viewing && (
                    <div className="space-y-4">
                        <div className="space-y-2.5">
                            {viewing.detalle.map((d, i) => (
                                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2">
                                    <span className="text-[13px] font-medium text-gray-700 leading-snug">{d.pregunta}</span>
                                    <span className="flex items-center gap-1.5 shrink-0">
                                        {d.tipo === 'estrellas' ? (
                                            <StarRow value={d.valor} size={13} />
                                        ) : (
                                            <span className="text-xs font-semibold text-gray-600">{d.etiqueta || d.valor}</span>
                                        )}
                                        <span className="text-xs font-bold text-gray-500 tabular-nums">{d.valor}/5</span>
                                    </span>
                                </div>
                            ))}
                        </div>

                        {viewing.comentario && (
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Comentario</span>
                                </div>
                                <p className="p-4 text-sm text-gray-700 whitespace-pre-line">{viewing.comentario}</p>
                            </div>
                        )}

                        {viewing.correo && (
                            <p className="text-sm text-gray-600">
                                <Mail size={14} className="inline mr-1.5 -mt-0.5 text-gray-400" />
                                {viewing.correo}
                                {viewing.aceptaPromos && (
                                    <span className="ml-2 text-[11px] font-bold text-emerald-600 uppercase">acepta promociones</span>
                                )}
                            </p>
                        )}
                    </div>
                )}
            </BaseModal>

            <SurveyLinkModal
                isOpen={isLinkOpen}
                onClose={() => setIsLinkOpen(false)}
                projectId={projectId}
                accentColor={moduleColor}
            />
        </PageShell>
    );
}
