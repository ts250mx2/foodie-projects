'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Ban,
    Check,
    CircleDashed,
    Cog,
    PackageCheck,
    ThumbsDown,
    XCircle,
} from 'lucide-react';
import BaseModal from '@/components/BaseModal';
import Button from '@/components/Button';
import { useToast } from '@/contexts/ToastContext';
import {
    MAX_REQUISITION_STATUS_NOTE,
    REQ_STATUS_ACCEPTED,
    REQ_STATUS_CANCELLED,
    REQ_STATUS_CREATED,
    REQ_STATUS_REJECTED,
    REQ_STATUS_RELEASED,
    RequisitionStatusTone,
    RequisitionTransition,
    getRequisitionStatusMeta,
    getRequisitionTransitions,
} from '@/lib/requisition-status';

/**
 * Modal de estado de una requisición.
 *
 * Dos mitades: arriba el TRACK (línea de tiempo con lo que tardó en cada
 * etapa, que es la razón de que la bitácora exista) y abajo los estados a los
 * que se puede mover desde el actual. Rechazar y Cancelar piden anotación
 * obligatoria; Salida de almacén avisa que va a restar existencias.
 */

interface StatusOrder {
    idOrdenCompra: number;
    folio: string;
    sucursal: string;
    status: number;
    fechaOrden: string | null;
    fechaAplicacion: string | null;
    solicitante: string | null;
    area: string | null;
}

interface StatusEvent {
    idEstatus: number | null;
    statusAnterior: number | null;
    statusNuevo: number;
    notas: string | null;
    usuario: string | null;
    fecha: string;
    sintetico: boolean;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    projectId: number | null;
    idOrdenCompra: number | null;
    accentColor?: string;
    /** Se dispara tras un cambio de estado exitoso para refrescar la tabla. */
    onChanged?: () => void;
}

/** Paleta por estado: el mismo tono se usa en badge, nodo y barra. */
const TONE_STYLES: Record<RequisitionStatusTone, { chip: string; dot: string; bar: string; text: string }> = {
    created:   { chip: 'bg-sky-50 text-sky-700 border-sky-200',           dot: 'bg-sky-500',     bar: '#0ea5e9', text: 'text-sky-700' },
    accepted:  { chip: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-500',   bar: '#f59e0b', text: 'text-amber-700' },
    released:  { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', bar: '#10b981', text: 'text-emerald-700' },
    rejected:  { chip: 'bg-rose-50 text-rose-700 border-rose-200',        dot: 'bg-rose-500',    bar: '#f43f5e', text: 'text-rose-700' },
    cancelled: { chip: 'bg-gray-100 text-gray-600 border-gray-200',       dot: 'bg-gray-400',    bar: '#9ca3af', text: 'text-gray-600' },
};

const STATUS_ICONS: Record<number, React.ElementType> = {
    [REQ_STATUS_CREATED]: CircleDashed,
    [REQ_STATUS_ACCEPTED]: Cog,
    [REQ_STATUS_RELEASED]: PackageCheck,
    [REQ_STATUS_REJECTED]: ThumbsDown,
    [REQ_STATUS_CANCELLED]: XCircle,
};

/** "2 d 3 h", "45 min", "12 s" — duración legible entre dos cambios. */
function formatDuration(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 1) return `${Math.max(1, Math.round(ms / 1000))} s`;
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
    if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
    return `${minutes} min`;
}

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function RequisitionStatusBadge({ status, size = 'sm' }: { status: number; size?: 'sm' | 'md' }) {
    const meta = getRequisitionStatusMeta(status);
    const tone = TONE_STYLES[meta.tone];
    const Icon = STATUS_ICONS[meta.status] ?? CircleDashed;
    const working = meta.status === REQ_STATUS_ACCEPTED;

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border font-black uppercase tracking-widest shadow-sm ${tone.chip} ${
                size === 'md' ? 'px-3.5 py-1.5 text-[11px]' : 'px-3 py-1 text-[9px]'
            }`}
        >
            <Icon size={size === 'md' ? 13 : 11} className={working ? 'animate-spin [animation-duration:3s]' : ''} />
            {meta.label}
        </span>
    );
}

export default function RequisitionStatusModal({
    isOpen,
    onClose,
    projectId,
    idOrdenCompra,
    accentColor,
    onChanged,
}: Props) {
    const { success, error: toastError } = useToast();

    const [order, setOrder] = useState<StatusOrder | null>(null);
    const [history, setHistory] = useState<StatusEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selected, setSelected] = useState<RequisitionTransition | null>(null);
    const [note, setNote] = useState('');

    // Sin dependencias de toast a propósito: los helpers del ToastContext
    // cambian de identidad en cada toast y volverían a disparar la carga.
    const loadTrack = useCallback(async () => {
        if (!projectId || !idOrdenCompra) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/requisitions/status?projectId=${projectId}&idOrdenCompra=${idOrdenCompra}`);
            const data = await res.json();
            if (data.success) {
                setOrder(data.data.order);
                setHistory(data.data.history);
                setLoadError(null);
            } else {
                setLoadError(data.message || 'No se pudo cargar el historial');
            }
        } catch {
            setLoadError('No se pudo cargar el historial');
        } finally {
            setIsLoading(false);
        }
    }, [projectId, idOrdenCompra]);

    // El track se recarga en cada apertura: es un registro vivo.
    useEffect(() => {
        if (!isOpen) return;
        setSelected(null);
        setNote('');
        setOrder(null);
        setHistory([]);
        setLoadError(null);
        loadTrack();
    }, [isOpen, loadTrack]);

    const transitions = useMemo(
        () => (order ? getRequisitionTransitions(order.status) : []),
        [order]
    );

    /**
     * Tramos del track: cada evento con lo que duró hasta el siguiente. El
     * último tramo corre contra "ahora" mientras la requisición siga viva.
     */
    const segments = useMemo(() => {
        const meta = order ? getRequisitionStatusMeta(order.status) : null;
        const now = Date.now();
        return history.map((event, index) => {
            const start = new Date(event.fecha).getTime();
            const next = history[index + 1];
            const isLast = index === history.length - 1;
            const end = next ? new Date(next.fecha).getTime() : (isLast && meta?.terminal ? start : now);
            return { event, start, durationMs: Math.max(0, end - start), open: !next && !meta?.terminal };
        });
    }, [history, order]);

    const totalDuration = useMemo(
        () => segments.reduce((sum, s) => sum + s.durationMs, 0),
        [segments]
    );

    const handleConfirm = async () => {
        if (!selected || !projectId || !idOrdenCompra) return;
        const trimmed = note.trim();
        if (selected.requiresNote && !trimmed) {
            toastError('La anotación es obligatoria para este cambio de estado');
            return;
        }
        if (selected.affectsWarehouse && !confirm(`${selected.warning}\n\n¿Continuar?`)) return;

        setIsSaving(true);
        try {
            const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
            const usuario = stored ? (JSON.parse(stored)?.nombreUsuario ?? null) : null;

            const res = await fetch('/api/requisitions/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    idOrdenCompra,
                    status: selected.to,
                    notas: trimmed || null,
                    usuario,
                }),
            });
            const data = await res.json();
            if (data.success) {
                success(data.message || 'Estado actualizado');
                setSelected(null);
                setNote('');
                await loadTrack();
                onChanged?.();
            } else {
                toastError(data.message || 'No se pudo cambiar el estado');
            }
        } catch {
            toastError('No se pudo cambiar el estado');
        } finally {
            setIsSaving(false);
        }
    };

    const currentMeta = order ? getRequisitionStatusMeta(order.status) : null;

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Estado de la requisición"
            subtitle={order ? `${order.folio} · ${order.sucursal}` : undefined}
            accentColor={accentColor}
            size="xl"
            headerVariant="primary"
            footer={
                <div className="flex items-center justify-end gap-2.5">
                    <Button variant="secondary" size="md" leftIcon={Ban} iconBox onClick={onClose} disabled={isSaving}>
                        Cerrar
                    </Button>
                    {selected && (
                        <Button
                            variant={selected.affectsWarehouse ? 'solid' : 'primary'}
                            size="md"
                            leftIcon={Check}
                            iconBox
                            onClick={handleConfirm}
                            isLoading={isSaving}
                            disabled={selected.requiresNote && !note.trim()}
                        >
                            {selected.actionLabel}
                        </Button>
                    )}
                </div>
            }
        >
            {isLoading && (
                <div className="py-14 text-center text-sm text-gray-400">Cargando historial…</div>
            )}

            {!isLoading && loadError && (
                <div className="flex items-center justify-center gap-2 py-14 text-sm text-rose-600">
                    <AlertTriangle size={16} />
                    {loadError}
                </div>
            )}

            {!isLoading && order && currentMeta && (
                <div className="space-y-6">
                    {/* ── Estado actual ─────────────────────────────────────── */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Estado actual</p>
                            <div className="mt-1.5 flex items-center gap-2.5">
                                <RequisitionStatusBadge status={order.status} size="md" />
                                <span className="text-xs text-gray-500">{currentMeta.description}</span>
                            </div>
                        </div>
                        <div className="text-right text-[11px] text-gray-400">
                            {order.solicitante && <p>Solicita: <span className="font-semibold text-gray-600">{order.solicitante}</span></p>}
                            {order.area && <p>Área: <span className="font-semibold text-gray-600">{order.area}</span></p>}
                        </div>
                    </div>

                    {/* ── Track: barra proporcional + línea de tiempo ────────── */}
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
                                Track de estados
                            </span>
                            {totalDuration > 0 && (
                                <span className="text-[11px] text-gray-400">
                                    Total: {formatDuration(totalDuration)}
                                </span>
                            )}
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Barra: cuánto pesó cada etapa sobre el total. */}
                            {totalDuration > 0 && (
                                <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
                                    {segments.map((segment, index) => {
                                        const meta = getRequisitionStatusMeta(segment.event.statusNuevo);
                                        const share = (segment.durationMs / totalDuration) * 100;
                                        if (share <= 0) return null;
                                        return (
                                            <div
                                                key={`${segment.event.idEstatus ?? 'syn'}-${index}`}
                                                title={`${meta.label}: ${formatDuration(segment.durationMs)}`}
                                                style={{ width: `${share}%`, backgroundColor: TONE_STYLES[meta.tone].bar }}
                                                className="h-full first:rounded-l-full last:rounded-r-full transition-all"
                                            />
                                        );
                                    })}
                                </div>
                            )}

                            {/* Línea de tiempo vertical. */}
                            <ol className="relative space-y-4 pl-6">
                                <span className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" aria-hidden="true" />
                                {segments.map((segment, index) => {
                                    const meta = getRequisitionStatusMeta(segment.event.statusNuevo);
                                    const tone = TONE_STYLES[meta.tone];
                                    const Icon = STATUS_ICONS[meta.status] ?? CircleDashed;
                                    return (
                                        <li key={`${segment.event.idEstatus ?? 'syn'}-${index}`} className="relative">
                                            <span
                                                className={`absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${tone.dot}`}
                                                aria-hidden="true"
                                            />
                                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${tone.text}`}>
                                                    <Icon size={13} />
                                                    {meta.label}
                                                </span>
                                                <span className="text-[11px] text-gray-400">{formatDateTime(segment.event.fecha)}</span>
                                                {segment.durationMs > 0 && (
                                                    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                                                        {segment.open ? 'lleva ' : ''}{formatDuration(segment.durationMs)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-0.5 text-[11px] text-gray-500">
                                                {segment.event.usuario && <span>Por {segment.event.usuario}</span>}
                                                {segment.event.sintetico && (
                                                    <span className="ml-1 italic text-gray-400">(reconstruido del registro)</span>
                                                )}
                                            </div>
                                            {segment.event.notas && (
                                                <p className="mt-1.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                                                    {segment.event.notas}
                                                </p>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                    </div>

                    {/* ── Cambio de estado ──────────────────────────────────── */}
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                            <span className="text-xs font-bold uppercase tracking-wide text-gray-700">Cambiar estado</span>
                        </div>

                        <div className="p-4">
                            {transitions.length === 0 ? (
                                <p className="text-sm text-gray-400">
                                    {currentMeta.label} es un estado final: la requisición ya no admite más cambios.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {transitions.map(transition => {
                                            const meta = getRequisitionStatusMeta(transition.to);
                                            const tone = TONE_STYLES[meta.tone];
                                            const Icon = STATUS_ICONS[meta.status] ?? CircleDashed;
                                            const isSelected = selected?.to === transition.to;
                                            return (
                                                <button
                                                    key={transition.to}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelected(isSelected ? null : transition);
                                                        setNote('');
                                                    }}
                                                    className={`flex items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition-all ${
                                                        isSelected
                                                            ? `${tone.chip} border-current shadow-sm`
                                                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.chip}`}>
                                                        <Icon
                                                            size={15}
                                                            className={meta.status === REQ_STATUS_ACCEPTED ? 'animate-spin [animation-duration:3s]' : ''}
                                                        />
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className={`block text-sm font-bold ${isSelected ? tone.text : 'text-gray-800'}`}>
                                                            {transition.label}
                                                        </span>
                                                        <span className="block text-[11px] leading-snug text-gray-500">
                                                            {meta.description}
                                                        </span>
                                                        {transition.requiresNote && (
                                                            <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wide text-rose-500">
                                                                Requiere anotación
                                                            </span>
                                                        )}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {selected?.warning && (
                                        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                                            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                                            <div className="text-xs leading-snug text-amber-800">
                                                <p className="font-semibold">{selected.warning}</p>
                                                <p className="mt-1 opacity-80">Almacén afectado: {order.sucursal}</p>
                                            </div>
                                        </div>
                                    )}

                                    {selected && (
                                        <div>
                                            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                                                Anotaciones {selected.requiresNote ? <span className="text-rose-500">*</span> : <span className="font-medium normal-case text-gray-400">(opcional)</span>}
                                            </label>
                                            <textarea
                                                value={note}
                                                onChange={(e) => setNote(e.target.value.slice(0, MAX_REQUISITION_STATUS_NOTE))}
                                                rows={3}
                                                autoFocus
                                                placeholder={
                                                    selected.requiresNote
                                                        ? 'Explica el motivo — queda guardado en el track de la requisición'
                                                        : 'Comentario para el track (opcional)'
                                                }
                                                className={`w-full resize-none rounded-lg border px-3 py-2 text-sm text-gray-800 outline-none transition-all ${
                                                    selected.requiresNote && !note.trim()
                                                        ? 'border-rose-300 bg-rose-50/40 focus:border-rose-500'
                                                        : 'border-gray-200 bg-white focus:border-blue-500'
                                                }`}
                                            />
                                            <div className="mt-1 text-right text-[10px] text-gray-400">
                                                {note.length}/{MAX_REQUISITION_STATUS_NOTE}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </BaseModal>
    );
}
