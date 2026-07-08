'use client';

import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, CheckCircle2, MapPin } from 'lucide-react';
import Button from '@/components/Button';
import BaseModal from '@/components/BaseModal';
import PageShell from '@/components/PageShell';

interface EventItem {
    IdCotizacion: number;
    NombreEvento: string;
    FechaEvento: string | null;
    HoraEvento: string | null;
    CantidadPlatillos: number;
    Recaudacion: number;
    IngresoEstimado: number;
    CostoTotal: number;
    UtilidadEstimada: number;
    Notas: string | null;
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const money = (v: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number.isFinite(v) ? v : 0);

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Normaliza la fecha del evento a una llave YYYY-MM-DD sin desfase de zona horaria.
const eventKey = (fecha: string | null) => (fecha ? String(fecha).substring(0, 10) : '');
const hhmm = (h: string | null) => (h ? String(h).substring(0, 5) : '');

export default function EventsCalendarPage() {
    const [project, setProject] = useState<any>(null);
    const [events, setEvents] = useState<EventItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
    const [selected, setSelected] = useState<EventItem | null>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) setProject(JSON.parse(storedProject));
    }, []);

    useEffect(() => {
        if (project?.idProyecto) fetchEvents();
    }, [project]);

    const fetchEvents = async () => {
        try {
            const res = await fetch(`/api/sales/events?projectId=${project.idProyecto}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) setEvents(data.data);
        } catch (e) {
            console.error('Error fetching events:', e);
        } finally {
            setIsLoading(false);
        }
    };

    // Eventos agrupados por día (YYYY-MM-DD), ordenados por hora dentro del día.
    const eventsByDay = useMemo(() => {
        const map = new Map<string, EventItem[]>();
        for (const e of events) {
            const key = eventKey(e.FechaEvento);
            if (!key) continue;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(e);
        }
        for (const list of map.values()) {
            list.sort((a, b) => hhmm(a.HoraEvento).localeCompare(hhmm(b.HoraEvento)));
        }
        return map;
    }, [events]);

    // Celdas del mes (empieza en domingo previo al día 1, termina completando semanas).
    const cells = useMemo(() => {
        const first = new Date(cursor.year, cursor.month, 1);
        const startDay = first.getDay();
        const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
        const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
        const todayKey = dayKey(new Date());
        return Array.from({ length: totalCells }, (_, i) => {
            const date = new Date(cursor.year, cursor.month, i - startDay + 1);
            const key = dayKey(date);
            return {
                date,
                key,
                inMonth: date.getMonth() === cursor.month,
                isToday: key === todayKey,
                events: eventsByDay.get(key) || [],
            };
        });
    }, [cursor, eventsByDay]);

    const monthLabel = new Date(cursor.year, cursor.month, 1)
        .toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

    const monthEventsCount = useMemo(
        () => events.filter((e) => {
            const k = eventKey(e.FechaEvento);
            return k && Number(k.substring(0, 4)) === cursor.year && Number(k.substring(5, 7)) === cursor.month + 1;
        }).length,
        [events, cursor]
    );

    const goPrev = () => setCursor((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
    const goNext = () => setCursor((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });
    const goToday = () => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }); };

    return (
        <PageShell
            title="Calendario de Eventos"
            subtitle={`${events.length} eventos confirmados · ${monthEventsCount} este mes`}
            icon={CalendarDays}
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={goToday}>Hoy</Button>
                    <div className="flex items-center gap-1">
                        <button onClick={goPrev} aria-label="Mes anterior" className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600">
                            <ChevronLeft size={16} />
                        </button>
                        <button onClick={goNext} aria-label="Mes siguiente" className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            }
        >
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                {/* Barra del mes */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-base font-bold text-gray-900 capitalize">{monthLabel}</h2>
                    <span className="text-xs text-gray-500 hidden sm:inline">Solo se muestran las cotizaciones confirmadas.</span>
                </div>

                {isLoading ? (
                    <div className="py-24 text-center text-sm text-gray-400">Cargando eventos…</div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="min-w-[720px]">
                            {/* Encabezados de día */}
                            <div className="grid grid-cols-7 border-b border-gray-100">
                                {WEEKDAYS.map((w) => (
                                    <div key={w} className="px-2 py-2 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wide">{w}</div>
                                ))}
                            </div>
                            {/* Celdas */}
                            <div className="grid grid-cols-7">
                                {cells.map((cell) => (
                                    <div
                                        key={cell.key}
                                        className={`min-h-[104px] border-b border-r border-gray-100 p-1.5 flex flex-col gap-1 ${cell.inMonth ? 'bg-white' : 'bg-gray-50/40'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span
                                                className={`inline-flex items-center justify-center w-6 h-6 text-xs rounded-full ${
                                                    cell.isToday
                                                        ? 'bg-brand-orange text-white font-bold'
                                                        : cell.inMonth ? 'text-gray-700 font-semibold' : 'text-gray-300'
                                                }`}
                                            >
                                                {cell.date.getDate()}
                                            </span>
                                            {cell.events.length > 0 && (
                                                <span className="text-[10px] font-semibold text-gray-400">{cell.events.length}</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1 overflow-hidden">
                                            {cell.events.map((e) => (
                                                <button
                                                    key={e.IdCotizacion}
                                                    onClick={() => setSelected(e)}
                                                    title={`${hhmm(e.HoraEvento)} ${e.NombreEvento}`}
                                                    className="group text-left rounded-md px-1.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 transition-colors"
                                                >
                                                    <span className="flex items-center gap-1 min-w-0">
                                                        {e.HoraEvento && (
                                                            <span className="shrink-0 text-[10px] font-bold text-emerald-700 tabular-nums">{hhmm(e.HoraEvento)}</span>
                                                        )}
                                                        <span className="truncate text-[11px] font-medium text-emerald-800">{e.NombreEvento}</span>
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Detalle del evento */}
            <BaseModal
                isOpen={!!selected}
                onClose={() => setSelected(null)}
                title={selected?.NombreEvento || 'Evento'}
                subtitle="Evento confirmado"
                size="md"
                footer={<div className="flex justify-end"><Button variant="secondary" onClick={() => setSelected(null)}>Cerrar</Button></div>}
            >
                {selected && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                                <CheckCircle2 size={12} /> Confirmado
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">
                                <CalendarDays size={12} />
                                {selected.FechaEvento ? new Date(eventKey(selected.FechaEvento) + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                            </span>
                            {selected.HoraEvento && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">
                                    <Clock size={12} /> {hhmm(selected.HoraEvento)}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <DetailStat label="Platillos" value={String(selected.CantidadPlatillos)} />
                            <DetailStat label="Recaudación" value={money(Number(selected.Recaudacion))} />
                            <DetailStat label="Ingreso estimado" value={money(Number(selected.IngresoEstimado))} />
                            <DetailStat label="Utilidad estimada" value={money(Number(selected.UtilidadEstimada))} positive={Number(selected.UtilidadEstimada) >= 0} />
                        </div>

                        {selected.Notas && (
                            <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1"><MapPin size={11} /> Notas</p>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.Notas}</p>
                            </div>
                        )}
                    </div>
                )}
            </BaseModal>
        </PageShell>
    );
}

function DetailStat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
    return (
        <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</p>
            <p className={`text-sm font-bold tabular-nums ${positive === undefined ? 'text-gray-900' : positive ? 'text-emerald-600' : 'text-rose-600'}`}>{value}</p>
        </div>
    );
}
