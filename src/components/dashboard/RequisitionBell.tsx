'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Bell, ClipboardCheck, Store, UserRound } from 'lucide-react';

interface PendingRequisition {
    IdOrdenCompra: number;
    FechaOrden: string;
    RequisicionSolicitante: string | null;
    RequisicionArea: string | null;
    Sucursal: string | null;
    Renglones: number;
}

const POLL_INTERVAL_MS = 60_000;

function formatWhen(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Avisa en el portal que llegaron requisiciones nuevas desde las tablets.
 * "Nueva" = nadie la ha abierto todavía (FechaRequisicionVista NULL); abrir una
 * desde aquí la marca vista, así que el contador refleja pendientes reales de
 * revisar y no un simple total del día.
 */
export default function RequisitionBell() {
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || 'es';

    const [projectId, setProjectId] = useState<number | null>(null);
    const [isEnabled, setIsEnabled] = useState(false);
    const [pending, setPending] = useState<PendingRequisition[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

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

    const fetchPending = useCallback(async (signal?: AbortSignal) => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/requisitions/pending?projectId=${projectId}`, { signal, cache: 'no-store' });
            const data = await res.json();
            if (data.success) setPending(data.data || []);
        } catch { /* la siguiente vuelta del poll reintenta */ }
    }, [projectId]);

    useEffect(() => {
        if (!projectId || !isEnabled) return;

        const controller = new AbortController();
        // El primer tiro sale en un timer y no en el cuerpo del efecto: llamar
        // setState de forma síncrona aquí encadena renders en cascada.
        const kickoff = setTimeout(() => fetchPending(controller.signal), 0);

        const interval = setInterval(() => fetchPending(), POLL_INTERVAL_MS);
        // Al volver a la pestaña se refresca sin esperar el siguiente ciclo.
        const onFocus = () => fetchPending();
        window.addEventListener('focus', onFocus);

        return () => {
            controller.abort();
            clearTimeout(kickoff);
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [projectId, isEnabled, fetchPending]);

    useEffect(() => {
        if (!isOpen) return;
        const onClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [isOpen]);

    const markSeen = async (idOrdenCompra?: number) => {
        if (!projectId) return;
        setPending(prev => (idOrdenCompra ? prev.filter(r => r.IdOrdenCompra !== idOrdenCompra) : []));
        try {
            await fetch('/api/requisitions/pending', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, idOrdenCompra }),
            });
        } catch {
            fetchPending();
        }
    };

    const openRequisition = async (requisition: PendingRequisition) => {
        setIsOpen(false);
        await markSeen(requisition.IdOrdenCompra);
        router.push(`/${locale}/dashboard/purchases/purchase-orders`);
    };

    if (!isEnabled || !projectId) return null;

    const count = pending.length;

    return (
        <div className="relative" ref={panelRef}>
            <button
                type="button"
                onClick={() => setIsOpen(open => !open)}
                className="relative flex items-center justify-center h-9 w-9 rounded-lg border border-white/20 text-white transition-all hover:bg-white/10 active:scale-95"
                title={count > 0 ? `${count} requisiciones nuevas` : 'Requisiciones'}
                aria-label={count > 0 ? `${count} requisiciones nuevas` : 'Requisiciones'}
            >
                <Bell size={17} />
                {count > 0 && (
                    <span
                        className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums border-2 animate-pulse"
                        style={{ backgroundColor: 'var(--color-brand-yellow)', color: '#0a0a0a', borderColor: 'var(--color-brand-green)' }}
                    >
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden z-50 text-gray-900">
                    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
                        <span className="font-bold text-sm">Requisiciones nuevas</span>
                        {count > 0 && (
                            <button
                                type="button"
                                onClick={() => markSeen()}
                                className="text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                            >
                                Marcar todas
                            </button>
                        )}
                    </div>

                    {count === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <ClipboardCheck size={28} className="mx-auto text-gray-300" />
                            <p className="text-sm text-gray-500 mt-2">Sin requisiciones pendientes</p>
                        </div>
                    ) : (
                        <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                            {pending.map(requisition => (
                                <li key={requisition.IdOrdenCompra}>
                                    <button
                                        type="button"
                                        onClick={() => openRequisition(requisition)}
                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-sm">Folio #{requisition.IdOrdenCompra}</span>
                                            <span className="text-[11px] text-gray-400">{formatWhen(requisition.FechaOrden)}</span>
                                        </div>
                                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-600">
                                            <span className="flex items-center gap-1 min-w-0">
                                                <Store size={12} className="shrink-0" />
                                                <span className="truncate">{requisition.Sucursal || 'Sin sucursal'}</span>
                                            </span>
                                            <span className="flex items-center gap-1 min-w-0">
                                                <UserRound size={12} className="shrink-0" />
                                                <span className="truncate">{requisition.RequisicionSolicitante || '—'}</span>
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--color-brand-green)' }}>
                                            {requisition.Renglones} {requisition.Renglones === 1 ? 'insumo' : 'insumos'}
                                            {requisition.RequisicionArea ? ` · ${requisition.RequisicionArea}` : ''}
                                        </p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
