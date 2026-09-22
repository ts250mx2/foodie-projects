'use client';

import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, BarChart3, CheckCircle2, ChevronRight, Clock3, FileSpreadsheet, FileUp, Layers3, RefreshCw, Rows3, UploadCloud } from 'lucide-react';
import PageShell from '@/components/PageShell';
import Button from '@/components/Button';
import { useToast } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';
import SalesImportViewer from '@/components/SalesImportViewer';
import DishSalesStatsViewer from '@/components/DishSalesStatsViewer';

type Project = { idProyecto?: number };
type ImportRecord = {
    IdImportacion: number; NombreArchivo: string; TamanoBytes: number;
    NumeroHojas: number; NumeroFilas: number; FechaReporte: string | null;
    FechaImportacion: string; Hojas: string[];
};

const MAX_BYTES = 20 * 1024 * 1024;

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function SalesImportPage() {
    const params = useParams();
    const locale = String(params.locale || 'es');
    const toast = useToast();
    const { colors } = useTheme();
    const inputRef = useRef<HTMLInputElement>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [imports, setImports] = useState<ImportRecord[]>([]);
    const [viewingImportId, setViewingImportId] = useState<number | null>(null);
    const [viewingStats, setViewingStats] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('project');
        if (saved) {
            try { setProject(JSON.parse(saved)); } catch { setProject(null); }
        } else setLoading(false);
    }, []);

    const loadImports = useCallback(async (projectId: number) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/sales/imports?projectId=${projectId}`, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message || 'No se pudo cargar el historial.');
            setImports(payload.data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo cargar el historial.');
        } finally { setLoading(false); }
    }, [toast]);

    useEffect(() => {
        if (project?.idProyecto) void loadImports(project.idProyecto);
    }, [project?.idProyecto, loadImports]);

    const chooseFile = (candidate?: File) => {
        if (!candidate) return;
        if (!/\.(xlsx|xls)$/i.test(candidate.name)) return toast.warning('Selecciona un archivo de Excel (.xlsx o .xls).');
        if (candidate.size > MAX_BYTES) return toast.warning('El archivo supera el límite de 20 MB.');
        setFile(candidate);
    };

    const onDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]);
    };

    const upload = async () => {
        if (!file || !project?.idProyecto) return;
        setUploading(true);
        try {
            const body = new FormData();
            body.append('projectId', String(project.idProyecto)); body.append('file', file);
            const response = await fetch('/api/sales/imports', { method: 'POST', body });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message || 'No se pudo importar el archivo.');
            const statsMessage = payload.data.salesItems ? ` ${payload.data.salesItems} artículos agregados a estadística${payload.data.replaced ? ' y el periodo anterior fue sustituido' : ''}.` : '';
            toast.success(`${payload.message} ${payload.data.sheets} hojas y ${payload.data.rows} filas guardadas.${statsMessage}`, 6000);
            setFile(null); if (inputRef.current) inputRef.current.value = '';
            await loadImports(project.idProyecto);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo importar el archivo.', 5000);
        } finally { setUploading(false); }
    };

    const dateFormatter = new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : locale, { dateStyle: 'medium', timeStyle: 'short' });

    return (
        <PageShell title={locale === 'es' ? 'Importar ventas' : 'Import sales'} subtitle={locale === 'es' ? 'Carga reportes de Excel y guárdalos completos en la base de datos de este proyecto.' : 'Upload Excel reports and store every sheet in this project database.'} icon={FileUp}>
            <div className="mx-auto max-w-7xl space-y-6 py-4">
                <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,.7fr)]">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-6 py-5">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Nueva importación</p>
                            <h2 className="mt-1 text-xl font-bold text-slate-900">Sube el reporte de ventas</h2>
                            <p className="mt-1 text-sm text-slate-500">Se conservan todas las hojas y únicamente se omiten filas completamente vacías.</p>
                        </div>
                        <div className="p-6">
                            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0])} />
                            <div role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click(); }} onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={onDrop} className={`group flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center outline-none transition-all focus-visible:ring-2 focus-visible:ring-offset-2 ${dragging ? 'scale-[1.01] bg-emerald-50' : 'bg-slate-50 hover:bg-slate-100/80'}`} style={{ borderColor: dragging ? colors.colorFondo1 : '#cbd5e1', '--tw-ring-color': colors.colorFondo1 } as React.CSSProperties}>
                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition-transform group-hover:-translate-y-1"><UploadCloud size={30} style={{ color: colors.colorFondo1 }} /></div>
                                {file ? <><p className="max-w-full truncate text-base font-bold text-slate-900">{file.name}</p><p className="mt-1 text-sm text-slate-500">{formatBytes(file.size)} · listo para importar</p></> : <><p className="text-base font-bold text-slate-900">Arrastra tu Excel aquí</p><p className="mt-1 text-sm text-slate-500">o haz clic para seleccionarlo</p><p className="mt-4 text-xs font-medium text-slate-400">XLSX o XLS · máximo 20 MB</p></>}
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 size={15} className="text-emerald-500" />Los archivos repetidos se detectan automáticamente.</div>
                                <Button leftIcon={FileUp} isLoading={uploading} disabled={!file || !project?.idProyecto} onClick={upload}>{uploading ? 'Importando' : 'Importar archivo'}</Button>
                            </div>
                        </div>
                    </div>
                    <aside className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><Layers3 size={22} /></div>
                        <h2 className="mt-6 text-lg font-bold">Qué se guarda</h2>
                        <div className="mt-5 space-y-5 text-sm text-slate-300">
                            <div className="flex gap-3"><FileSpreadsheet className="mt-0.5 shrink-0 text-emerald-400" size={18} /><p><strong className="block text-white">Archivo</strong>Nombre, tamaño, fecha y huella para evitar duplicados.</p></div>
                            <div className="flex gap-3"><Layers3 className="mt-0.5 shrink-0 text-emerald-400" size={18} /><p><strong className="block text-white">Hojas</strong>Nombre, orden y dimensiones originales.</p></div>
                            <div className="flex gap-3"><Rows3 className="mt-0.5 shrink-0 text-emerald-400" size={18} /><p><strong className="block text-white">Filas</strong>Valores y número de fila para reconstruir cada tabla.</p></div>
                        </div>
                    </aside>
                </section>
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Este proyecto</p><h2 className="mt-1 text-xl font-bold text-slate-900">Historial de importaciones</h2></div><div className="flex items-center gap-2"><Button variant="secondary" leftIcon={BarChart3} disabled={!project?.idProyecto} onClick={() => setViewingStats(true)}>Ventas por platillo</Button><button type="button" onClick={() => project?.idProyecto && loadImports(project.idProyecto)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2" aria-label="Actualizar historial"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button></div></div>
                    {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><RefreshCw size={17} className="animate-spin" /> Cargando importaciones</div> : imports.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><FileSpreadsheet size={32} className="text-slate-300" /><p className="mt-3 font-semibold text-slate-700">Aún no hay archivos importados</p><p className="mt-1 text-sm text-slate-500">La primera importación aparecerá aquí con sus hojas y filas.</p></div> : <div className="divide-y divide-slate-100">{imports.map(item => <button type="button" onClick={() => setViewingImportId(item.IdImportacion)} key={item.IdImportacion} className="grid w-full gap-4 px-6 py-5 text-left transition hover:bg-slate-50 focus-visible:bg-emerald-50 focus-visible:outline-none md:grid-cols-[minmax(0,1fr)_auto] md:items-center"><div className="min-w-0"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><FileSpreadsheet size={20} /></span><div className="min-w-0"><h3 className="truncate font-bold text-slate-900">{item.NombreArchivo}</h3><p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={12} /> {dateFormatter.format(new Date(item.FechaImportacion))}</p></div></div><div className="mt-3 flex flex-wrap gap-1.5 pl-13">{item.Hojas.map(name => <span key={name} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">{name}</span>)}</div></div><div className="flex items-center gap-5 text-sm md:justify-end"><div><span className="block text-xs text-slate-400">Hojas</span><strong className="text-slate-800">{item.NumeroHojas}</strong></div><div><span className="block text-xs text-slate-400">Filas</span><strong className="text-slate-800">{Number(item.NumeroFilas).toLocaleString()}</strong></div><div><span className="block text-xs text-slate-400">Tamaño</span><strong className="text-slate-800">{formatBytes(Number(item.TamanoBytes))}</strong></div><ChevronRight size={18} className="text-slate-300" /></div></button>)}</div>}
                    {!project?.idProyecto && !loading && <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-800"><AlertCircle size={17} /> No se encontró un proyecto activo. Vuelve a iniciar sesión.</div>}
                </section>
            </div>
            {viewingImportId && project?.idProyecto && <SalesImportViewer importId={viewingImportId} projectId={project.idProyecto} onClose={() => setViewingImportId(null)} />}
            {viewingStats && project?.idProyecto && <DishSalesStatsViewer projectId={project.idProyecto} onClose={() => setViewingStats(false)} />}
        </PageShell>
    );
}
