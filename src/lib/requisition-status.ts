/**
 * Ciclo de vida de una requisición (tblOrdenesCompra con EsRequisicion/EsInterna/EsSalida).
 *
 * Módulo PURO: lo importan tanto las rutas de API como los componentes de
 * cliente, así que no debe traer mysql, lucide ni nada pesado.
 *
 *   Creada ──► Aceptada ──► Salida de almacén   (aplica al inventario)
 *      │           └─────► Cancelada            (requiere anotación)
 *      └─────────────────► Rechazada            (requiere anotación)
 *
 * Los códigos reutilizan los Status históricos de tblOrdenesCompra (ver
 * src/lib/warehouse.ts) para no reenseñarle estados nuevos a cada consulta:
 * Rechazada es la vieja "Descartada" (5) y Cancelada la vieja "Cancelada" (3).
 * El único código nuevo es Aceptada (6). El estado "Fantasma" desapareció de
 * la interfaz: ese mismo 4 ahora se llama Creada.
 */

export const REQ_STATUS_RELEASED = 1;   // Salida de almacén — ya restó existencias
export const REQ_STATUS_CANCELLED = 3;  // Cancelada (después de aceptarse)
export const REQ_STATUS_CREATED = 4;    // Creada (nace aquí)
export const REQ_STATUS_REJECTED = 5;   // Rechazada (antes de aceptarse)
export const REQ_STATUS_ACCEPTED = 6;   // Aceptada — en proceso de surtido

/** Status 0 es "En Tránsito" legado: se lee como Creada. */
export const REQ_STATUS_LEGACY_CREATED = 0;

export type RequisitionStatus =
    | typeof REQ_STATUS_RELEASED
    | typeof REQ_STATUS_CANCELLED
    | typeof REQ_STATUS_CREATED
    | typeof REQ_STATUS_REJECTED
    | typeof REQ_STATUS_ACCEPTED;

/** Tono visual del estado; los componentes lo traducen a clases e iconos. */
export type RequisitionStatusTone = 'created' | 'accepted' | 'released' | 'rejected' | 'cancelled';

export interface RequisitionStatusMeta {
    status: RequisitionStatus;
    label: string;
    tone: RequisitionStatusTone;
    /** Descripción corta para el modal de cambio de estado. */
    description: string;
    /** Estado final: ya no admite más cambios. */
    terminal: boolean;
}

export const REQUISITION_STATUS_META: Record<number, RequisitionStatusMeta> = {
    [REQ_STATUS_CREATED]: {
        status: REQ_STATUS_CREATED,
        label: 'Creada',
        tone: 'created',
        description: 'Levantada y a la espera de que almacén la acepte o la rechace.',
        terminal: false,
    },
    [REQ_STATUS_ACCEPTED]: {
        status: REQ_STATUS_ACCEPTED,
        label: 'Aceptada',
        tone: 'accepted',
        description: 'Almacén la tomó y está trabajando en surtirla.',
        terminal: false,
    },
    [REQ_STATUS_RELEASED]: {
        status: REQ_STATUS_RELEASED,
        label: 'Salida de almacén',
        tone: 'released',
        description: 'Surtida: restó existencias del almacén al costo promedio vigente.',
        terminal: true,
    },
    [REQ_STATUS_REJECTED]: {
        status: REQ_STATUS_REJECTED,
        label: 'Rechazada',
        tone: 'rejected',
        description: 'Almacén no la va a surtir. No afecta existencias.',
        terminal: true,
    },
    [REQ_STATUS_CANCELLED]: {
        status: REQ_STATUS_CANCELLED,
        label: 'Cancelada',
        tone: 'cancelled',
        description: 'Se aceptó pero se dio de baja antes de surtirse. No afecta existencias.',
        terminal: true,
    },
};

/** Normaliza el Status crudo de la orden al del ciclo de vida (0 legado → Creada). */
export function normalizeRequisitionStatus(status: unknown): RequisitionStatus {
    const value = Number(status);
    if (value === REQ_STATUS_LEGACY_CREATED) return REQ_STATUS_CREATED;
    if (REQUISITION_STATUS_META[value]) return value as RequisitionStatus;
    return REQ_STATUS_CREATED;
}

export function getRequisitionStatusMeta(status: unknown): RequisitionStatusMeta {
    return REQUISITION_STATUS_META[normalizeRequisitionStatus(status)];
}

export interface RequisitionTransition {
    to: RequisitionStatus;
    label: string;
    /** Texto de la acción en el modal (verbo). */
    actionLabel: string;
    /** La anotación es obligatoria para dejar constancia del motivo. */
    requiresNote: boolean;
    /** Al confirmarse descarga el almacén. */
    affectsWarehouse: boolean;
    /** Advertencia que el modal muestra antes de confirmar. */
    warning?: string;
}

const TRANSITIONS: Record<number, RequisitionTransition[]> = {
    [REQ_STATUS_CREATED]: [
        {
            to: REQ_STATUS_ACCEPTED,
            label: 'Aceptada',
            actionLabel: 'Aceptar requisición',
            requiresNote: false,
            affectsWarehouse: false,
        },
        {
            to: REQ_STATUS_REJECTED,
            label: 'Rechazada',
            actionLabel: 'Rechazar requisición',
            requiresNote: true,
            affectsWarehouse: false,
        },
    ],
    [REQ_STATUS_ACCEPTED]: [
        {
            to: REQ_STATUS_RELEASED,
            label: 'Salida de almacén',
            actionLabel: 'Dar salida de almacén',
            requiresNote: false,
            affectsWarehouse: true,
            warning: 'Se RESTARÁN del almacén las cantidades de esta requisición, al costo promedio vigente. Una vez aplicada no podrá editarse ni eliminarse.',
        },
        {
            to: REQ_STATUS_CANCELLED,
            label: 'Cancelada',
            actionLabel: 'Cancelar requisición',
            requiresNote: true,
            affectsWarehouse: false,
        },
    ],
};

/** Estados a los que puede moverse una requisición desde el estado dado. */
export function getRequisitionTransitions(status: unknown): RequisitionTransition[] {
    return TRANSITIONS[normalizeRequisitionStatus(status)] ?? [];
}

export function findRequisitionTransition(from: unknown, to: unknown): RequisitionTransition | null {
    const target = Number(to);
    return getRequisitionTransitions(from).find(t => t.to === target) ?? null;
}

/** Una requisición surtida quedó congelada: ni edición ni borrado. */
export function isRequisitionLocked(status: unknown, fechaAplicacion?: string | null): boolean {
    return Boolean(fechaAplicacion) || normalizeRequisitionStatus(status) === REQ_STATUS_RELEASED;
}

export const MAX_REQUISITION_STATUS_NOTE = 500;
