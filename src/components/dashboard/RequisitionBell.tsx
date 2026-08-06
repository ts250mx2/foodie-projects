'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Bell, ClipboardCheck, Package, Store, UserRound, Volume2 } from 'lucide-react';
import { useRequisitionAlarm } from './useRequisitionAlarm';

interface Requisition {
    IdOrdenCompra: number;
    FechaOrden: string;
    FechaRequisicionVista: string | null;
    RequisicionSolicitante: string | null;
    RequisicionArea: string | null;
    Sucursal: string | null;
    Renglones: number;
    Unidades: number | string | null;
    Resumen: string | null;
}

const POLL_INTERVAL_MS = 60_000;

/**
 * El panel vive dentro del <header>, que tiene `text-white`. Cualquier texto que
 * dependa de herencia sale blanco sobre fondo blanco, así que aquí TODO lleva
 * color explícito. No heredar es la regla en este subárbol.
 */
const PANEL_INK = '#111827';
const PANEL_INK_SOFT = '#4b5563';

/** Verde legible para etiquetas (4.9:1 sobre blanco). Los vars --color-brand-*
 *  de globals.css están cruzados: --color-brand-green es en realidad #f4481e. */
const LABEL_GREEN = '#15803d';

/** Cuántos productos se nombran antes de resumir el resto como "+N más". */
const SUMMARY_ITEMS = 3;

function formatWhen(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** "hace 15 min" — en una alerta operativa importa más que la hora exacta. */
function formatAgo(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'ahora';
    if (minutes < 60) return `hace ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;

    const days = Math.floor(hours / 24);
    return days === 1 ? 'ayer' : `hace ${days} días`;
}

/** Quita un "(3) " o "(9+) " previo para no encadenar prefijos al reaplicar. */
function stripBadge(title: string): string {
    return title.replace(/^\(\d+\+?\)\s*/, '');
}

/** "Jitomate · Cebolla · Aceite +2 más" */
function buildSummary(resumen: string | null, renglones: number): string {
    if (!resumen) return 'Sin productos';
    const names = resumen.split(' · ').filter(Boolean);
    const shown = names.slice(0, SUMMARY_ITEMS).join(' · ');
    const rest = Math.max(renglones, names.length) - SUMMARY_ITEMS;
    return rest > 0 ? `${shown} +${rest} más` : shown;
}

/**
 * Avisa en el portal que llegaron requisiciones desde las tablets.
 *
 * La bandeja es un historial: abrir una la marca como leída pero NO la quita,
 * así se puede volver a ella. El badge y la alarma cuentan solo las no leídas.
 */
export default function RequisitionBell() {
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || 'es';

    const [projectId, setProjectId] = useState<number | null>(null);
    const [isEnabled, setIsEnabled] = useState(false);
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const unreadCount = requisitions.filter(r => !r.FechaRequisicionVista).length;

    // La alarma suena mientras quede al menos una requisición sin leer.
    const { needsUnlock, unlock } = useRequisitionAlarm(isEnabled && unreadCount > 0);

    useEffect(() => {
        const readProject = () => {
            try {
                const stored = localStorage.getItem('project');
                if (!stored) return;
                const parsed = JSON.parse(stored);
                setProjectId(parsed.idProyecto ?? null);
                // El módulo de compras puede estar apagado para el proyecto.
                setIsEnabled(parsed.purchaseOrdersEnabled !== 0);
            } catch { /* proyecto no disponible aún */ }
        };

        readProject();
        window.addEventListener('project-settings-updated', readProject);
        return () => window.removeEventListener('project-settings-updated', readProject);
    }, []);

    const fetchRequisitions = useCallback(async (signal?: AbortSignal) => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/requisitions/pending?projectId=${projectId}`, { signal, cache: 'no-store' });
            const data = await res.json();
            if (data.success) setRequisitions(data.data || []);
        } catch { /* la siguiente vuelta del poll reintenta */ }
    }, [projectId]);

    useEffect(() => {
        if (!projectId || !isEnabled) return;

        const controller = new AbortController();
        // El primer tiro sale en un timer y no en el cuerpo del efecto: llamar
        // setState de forma síncrona aquí encadena renders en cascada.
        const kickoff = setTimeout(() => fetchRequisitions(controller.signal), 0);

        const interval = setInterval(() => fetchRequisitions(), POLL_INTERVAL_MS);
        // Al volver a la pestaña se refresca sin esperar el siguiente ciclo.
        const onFocus = () => fetchRequisitions();
        window.addEventListener('focus', onFocus);

        return () => {
            controller.abort();
            clearTimeout(kickoff);
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [projectId, isEnabled, fetchRequisitions]);

    useEffect(() => {
        if (!isOpen) return;
        const onClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [isOpen]);

    /**
     * Contador en el título de la pestaña: "(3) Foodie Gurú". Es el único lugar
     * donde el número te alcanza sin estar viendo la app.
     *
     * Next reescribe el título en cada navegación, así que no basta con fijarlo
     * una vez: un MutationObserver vuelve a anteponer el prefijo cuando eso pasa.
     * El observer no se cicla porque solo escribe si el título difiere.
     */
    useEffect(() => {
        if (unreadCount <= 0) {
            document.title = stripBadge(document.title);
            return;
        }

        const prefix = `(${unreadCount > 9 ? '9+' : unreadCount}) `;
        const applyBadge = () => {
            const next = prefix + stripBadge(document.title);
            if (document.title !== next) document.title = next;
        };

        applyBadge();

        const titleElement = document.querySelector('title');
        const observer = titleElement ? new MutationObserver(applyBadge) : null;
        observer?.observe(titleElement!, { childList: true });

        return () => {
            observer?.disconnect();
            document.title = stripBadge(document.title);
        };
    }, [unreadCount]);

    /** Marca como leída sin sacarla de la bandeja. */
    const markRead = async (idOrdenCompra?: number) => {
        if (!projectId) return;
        const now = new Date().toISOString();
        setRequisitions(prev => prev.map(r =>
            (idOrdenCompra === undefined || r.IdOrdenCompra === idOrdenCompra) && !r.FechaRequisicionVista
                ? { ...r, FechaRequisicionVista: now }
                : r
        ));
        try {
            await fetch('/api/requisitions/pending', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, idOrdenCompra }),
            });
        } catch {
            fetchRequisitions();
        }
    };

    const openRequisition = async (requisition: Requisition) => {
        setIsOpen(false);
        await markRead(requisition.IdOrdenCompra);
        // ?orden= le dice a la pantalla de Órdenes de Compra que abra esta
        // orden en su modal de detalle en cuanto termine de cargar.
        router.push(`/${locale}/dashboard/purchases/purchase-orders?orden=${requisition.IdOrdenCompra}`);
    };

    if (!isEnabled || !projectId) return null;

    return (
        <div className="relative flex items-center gap-2" ref={panelRef}>
            {/* El navegador bloquea el audio hasta que haya un gesto del usuario.
                Sin este botón la alarma fallaría en silencio. */}
            {needsUnlock && unreadCount > 0 && (
                <button
                    type="button"
                    onClick={unlock}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold border-2 animate-pulse"
                    style={{ backgroundColor: 'var(--color-brand-yellow)', color: '#0a0a0a', borderColor: '#ffffff' }}
                    title="El navegador bloqueó el sonido. Toca para activarlo."
                >
                    <Volume2 size={15} />
                    Activar sonido
                </button>
            )}

            <button
                type="button"
                onClick={() => setIsOpen(open => !open)}
                className="relative flex items-center justify-center h-9 w-9 rounded-lg border border-white/20 text-white transition-all hover:bg-white/10 active:scale-95"
                title={unreadCount > 0 ? `${unreadCount} requisiciones nuevas` : 'Requisiciones'}
                aria-label={unreadCount > 0 ? `${unreadCount} requisiciones nuevas` : 'Requisiciones'}
            >
                <Bell size={17} />
                {unreadCount > 0 && (
                    <span
                        className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums border-2 animate-pulse"
                        style={{ backgroundColor: 'var(--color-brand-yellow)', color: '#0a0a0a', borderColor: 'var(--color-brand-green)' }}
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 max-w-[92vw] rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden z-50 text-gray-900">
                    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
                        <span className="font-bold text-sm" style={{ color: PANEL_INK }}>
                            Requisiciones
                            {unreadCount > 0 && (
                                <span className="ml-1.5 font-semibold" style={{ color: PANEL_INK_SOFT }}>
                                    ({unreadCount} sin leer)
                                </span>
                            )}
                        </span>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={() => markRead()}
                                className="text-xs font-semibold hover:underline transition-colors"
                                style={{ color: PANEL_INK_SOFT }}
                            >
                                Marcar todas
                            </button>
                        )}
                    </div>

                    {requisitions.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <ClipboardCheck size={28} className="mx-auto text-gray-300" />
                            <p className="text-sm mt-2" style={{ color: PANEL_INK_SOFT }}>Sin requisiciones recientes</p>
                        </div>
                    ) : (
                        <ul className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                            {requisitions.map(requisition => {
                                const isUnread = !requisition.FechaRequisicionVista;
                                const unidades = Number(requisition.Unidades) || 0;
                                return (
                                    <li key={requisition.IdOrdenCompra}>
                                        <button
                                            type="button"
                                            onClick={() => openRequisition(requisition)}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-l-4"
                                            style={{
                                                borderLeftColor: isUnread ? 'var(--color-brand-green)' : 'transparent',
                                                backgroundColor: isUnread ? '#f7fdf9' : undefined,
                                            }}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className={`text-sm ${isUnread ? 'font-bold' : 'font-semibold'}`}
                                                    style={{ color: isUnread ? PANEL_INK : PANEL_INK_SOFT }}
                                                >
                                                    Folio #{requisition.IdOrdenCompra}
                                                    {!isUnread && (
                                                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>
                                                            Leída
                                                        </span>
                                                    )}
                                                </span>
                                                <span
                                                    className="text-[11px] shrink-0"
                                                    style={{ color: '#6b7280' }}
                                                    title={formatWhen(requisition.FechaOrden)}
                                                >
                                                    {formatAgo(requisition.FechaOrden)}
                                                </span>
                                            </div>

                                            <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: PANEL_INK_SOFT }}>
                                                <span className="flex items-center gap-1 min-w-0">
                                                    <Store size={12} className="shrink-0" />
                                                    <span className="truncate">{requisition.Sucursal || 'Sin sucursal'}</span>
                                                </span>
                                                <span className="flex items-center gap-1 min-w-0">
                                                    <UserRound size={12} className="shrink-0" />
                                                    <span className="truncate">
                                                        {requisition.RequisicionSolicitante || '—'}
                                                        {requisition.RequisicionArea ? ` · ${requisition.RequisicionArea}` : ''}
                                                    </span>
                                                </span>
                                            </div>

                                            {/* Qué se pidió, en su propia caja: es lo que permite decidir
                                                si urge sin tener que abrir la orden. */}
                                            <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                                                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: LABEL_GREEN }}>
                                                    <Package size={12} className="shrink-0" />
                                                    {requisition.Renglones} {requisition.Renglones === 1 ? 'insumo' : 'insumos'}
                                                    {unidades > 0 && ` · ${unidades.toLocaleString('es-MX')} u`}
                                                </p>
                                                <p className="mt-1 text-[13px] font-medium line-clamp-3 leading-snug" style={{ color: PANEL_INK }}>
                                                    {buildSummary(requisition.Resumen, requisition.Renglones)}
                                                </p>
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
