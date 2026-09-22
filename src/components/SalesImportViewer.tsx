'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, X } from 'lucide-react';

type Sheet = {
    IdHoja: number; NombreHoja: string; OrdenHoja: number; RangoOriginal: string | null;
    NumeroFilas: number; NumeroColumnas: number;
};
type GridRow = { number: number; values: Array<string | number | boolean | null> };
type ImportHeader = { NombreArchivo: string; NumeroHojas: number; NumeroFilas: number; FechaImportacion: string };
type Props = { importId: number; projectId: number; onClose: () => void };

function columnName(index: number) {
    let value = index + 1;
    let result = '';
    while (value > 0) {
        value -= 1;
        result = String.fromCharCode(65 + (value % 26)) + result;
        value = Math.floor(value / 26);
    }
    return result;
}

function displayValue(value: GridRow['values'][number]) {
    if (value == null) return '';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'number') return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 }).format(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat('es-MX').format(date);
    }
    return value;
}

export default function SalesImportViewer({ importId, projectId, onClose }: Props) {
    const [header, setHeader] = useState<ImportHeader | null>(null);
    const [sheets, setSheets] = useState<Sheet[]>([]);
    const [activeSheetId, setActiveSheetId] = useState<number | null>(null);
    const [rows, setRows] = useState<GridRow[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadMetadata = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const response = await fetch(`/api/sales/imports/${importId}?projectId=${projectId}`, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message);
            setHeader(payload.data.import); setSheets(payload.data.sheets);
            setActiveSheetId(payload.data.sheets[0]?.IdHoja ?? null);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'No se pudo abrir la importación.');
            setLoading(false);
        }
    }, [importId, projectId]);

    const loadRows = useCallback(async (sheetId: number, targetPage: number) => {
        setLoading(true); setError('');
        try {
            const query = new URLSearchParams({ projectId: String(projectId), sheetId: String(sheetId), page: String(targetPage), pageSize: '75' });
            const response = await fetch(`/api/sales/imports/${importId}?${query}`, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message);
            setRows(payload.data.rows); setTotalPages(payload.data.totalPages); setPage(payload.data.page);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'No se pudo cargar la hoja.');
        } finally { setLoading(false); }
    }, [importId, projectId]);

    useEffect(() => { void loadMetadata(); }, [loadMetadata]);
    useEffect(() => { if (activeSheetId) void loadRows(activeSheetId, 1); }, [activeSheetId, loadRows]);
    useEffect(() => {
        const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', close);
        return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', close); };
    }, [onClose]);

    const activeSheet = sheets.find(sheet => sheet.IdHoja === activeSheetId);
    const columnCount = useMemo(() => Math.max(1, Number(activeSheet?.NumeroColumnas || 0)), [activeSheet]);

    return (
        <div className="fixed inset-0 z-[100] flex bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label="Datos importados">
            <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
                    <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300"><FileSpreadsheet size={21} /></span><div className="min-w-0"><h2 className="truncate font-bold">{header?.NombreArchivo || 'Cargando archivo'}</h2><p className="text-xs text-slate-400">{header ? `${header.NumeroHojas} hojas · ${Number(header.NumeroFilas).toLocaleString()} filas guardadas` : 'Preparando vista'}</p></div></div>
                    <button onClick={onClose} className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label="Cerrar visor"><X size={20} /></button>
                </header>

                <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-3 pt-3" aria-label="Hojas del Excel">
                    {sheets.map(sheet => <button key={sheet.IdHoja} onClick={() => setActiveSheetId(sheet.IdHoja)} className={`whitespace-nowrap rounded-t-lg border border-b-0 px-4 py-2.5 text-sm font-semibold transition ${activeSheetId === sheet.IdHoja ? 'border-slate-200 bg-white text-emerald-700' : 'border-transparent text-slate-500 hover:bg-white/70 hover:text-slate-800'}`}>{sheet.NombreHoja}<span className="ml-2 text-xs font-normal text-slate-400">{sheet.NumeroFilas}</span></button>)}
                </nav>

                <div className="relative min-h-0 flex-1 overflow-auto bg-white">
                    {error ? <div className="flex h-full min-h-60 flex-col items-center justify-center p-6 text-center"><p className="font-semibold text-red-700">{error}</p><button onClick={loadMetadata} className="mt-3 text-sm font-semibold text-emerald-700 hover:underline">Intentar de nuevo</button></div> : loading && rows.length === 0 ? <div className="flex h-full min-h-60 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Cargando datos</div> : (
                        <table className="min-w-max border-separate border-spacing-0 text-xs text-slate-700">
                            <thead className="sticky top-0 z-20"><tr><th className="sticky left-0 z-30 w-14 border-b border-r border-slate-300 bg-slate-200 px-3 py-2 text-center text-slate-500">#</th>{Array.from({ length: columnCount }, (_, index) => <th key={index} className="min-w-32 border-b border-r border-slate-300 bg-slate-100 px-3 py-2 text-center font-bold text-slate-500">{columnName(index)}</th>)}</tr></thead>
                            <tbody>{rows.map(row => <tr key={row.number} className="hover:bg-emerald-50/40"><th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-right font-semibold text-slate-400">{row.number}</th>{Array.from({ length: columnCount }, (_, index) => <td key={index} className="max-w-80 border-b border-r border-slate-200 px-3 py-2 align-top"><div className="max-h-20 overflow-hidden whitespace-pre-wrap break-words" title={String(row.values[index] ?? '')}>{displayValue(row.values[index])}</div></td>)}</tr>)}</tbody>
                        </table>
                    )}
                    {loading && rows.length > 0 && <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/70"><Loader2 size={22} className="animate-spin text-emerald-600" /></div>}
                </div>

                <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                    <span>{activeSheet?.RangoOriginal ? `Rango original: ${activeSheet.RangoOriginal}` : 'Hoja sin rango registrado'}</span>
                    <div className="flex items-center gap-2"><button disabled={page <= 1 || loading || !activeSheetId} onClick={() => activeSheetId && loadRows(activeSheetId, page - 1)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40" aria-label="Página anterior"><ChevronLeft size={15} /></button><span className="min-w-24 text-center font-semibold text-slate-700">Página {page} de {totalPages}</span><button disabled={page >= totalPages || loading || !activeSheetId} onClick={() => activeSheetId && loadRows(activeSheetId, page + 1)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40" aria-label="Página siguiente"><ChevronRight size={15} /></button></div>
                </footer>
            </div>
        </div>
    );
}
