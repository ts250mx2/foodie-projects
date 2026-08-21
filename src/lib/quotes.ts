/**
 * Fórmulas del módulo de Cotizaciones de eventos.
 * Módulo puro (sin React/mysql) para usarse tanto en el cliente (cálculo en vivo)
 * como en el servidor (al guardar), garantizando que ambos usen las mismas fórmulas.
 *
 * Una cotización tiene VARIOS platillos (líneas): cada uno con su cantidad, costo
 * unitario (tomado del costeo del platillo) y precio unitario. Los totales se
 * agregan sobre todas las líneas y se les suman los gastos operativos.
 */

export interface QuoteGasto {
    concepto: string;
    monto: number;
}

export interface QuoteDish {
    idPlatillo: number | null;
    platillo: string;
    tipo: number | null;     // 0=insumo, 1=platillo, 2=sub-receta, null=manual/libre
    unidad?: string;         // unidad de medida (default: UnidadMedidaInventario del producto; editable)
    cantidad: number;
    costoUnitario: number;   // costo de costeo por platillo
    precioUnitario: number;  // precio de venta por platillo
}

export interface QuoteDishTotals {
    total: number;        // cantidad × precio unitario
    recaudacion: number;  // (cantidad × precio) − (cantidad × costo)
}

/** Totales de una sola línea de platillo (para mostrarlos en vivo por línea). */
export function computeDishLineTotals(dish: Partial<QuoteDish>): QuoteDishTotals {
    const cantidad = n(dish?.cantidad);
    const precio = n(dish?.precioUnitario);
    const costo = n(dish?.costoUnitario);
    const total = cantidad * precio;
    return { total, recaudacion: total - cantidad * costo };
}

export interface QuoteInput {
    platillos: QuoteDish[];
    recaudacion: number;
    gastos: QuoteGasto[];
}

export interface QuoteTotals {
    cantidadPlatillos: number;  // suma de cantidades de todas las líneas
    gastosOperativos: number;   // suma de los gastos operativos
    costoPlatillos: number;     // Σ(cantidad × costo unitario)
    ingresoEstimado: number;    // Σ(cantidad × precio unitario)
    costoTotal: number;         // costo platillos + gastos operativos
    utilidadEstimada: number;   // ingreso estimado − costo total
    utilidadReal: number;       // recaudación − costo total
    margenReal: number;         // utilidad real / recaudación (%)
}

const n = (v: unknown): number => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
};

/** Normaliza el arreglo de gastos operativos recibido del cliente. */
export function normalizeGastos(gastos: unknown): QuoteGasto[] {
    if (!Array.isArray(gastos)) return [];
    return gastos
        .filter((g: any) => g && (g.concepto || g.monto))
        .map((g: any) => ({ concepto: String(g.concepto || ''), monto: n(g.monto) }));
}

/** Normaliza el arreglo de líneas de platillo recibido del cliente. */
export function normalizeDishes(platillos: unknown): QuoteDish[] {
    if (!Array.isArray(platillos)) return [];
    return platillos
        .filter((p: any) => p && (p.idPlatillo || p.platillo || p.cantidad))
        .map((p: any) => ({
            idPlatillo: p.idPlatillo !== null && p.idPlatillo !== undefined && p.idPlatillo !== '' ? Number(p.idPlatillo) : null,
            platillo: String(p.platillo || ''),
            tipo: p.tipo !== null && p.tipo !== undefined && p.tipo !== '' ? Number(p.tipo) : null,
            unidad: String(p.unidad || ''),
            cantidad: n(p.cantidad),
            costoUnitario: n(p.costoUnitario),
            precioUnitario: n(p.precioUnitario),
        }));
}

/** Calcula todos los totales derivados de una cotización a partir de sus entradas. */
export function computeQuoteTotals(input: Partial<QuoteInput>): QuoteTotals {
    const platillos = input.platillos || [];
    const cantidadPlatillos = platillos.reduce((s, p) => s + n(p?.cantidad), 0);
    const costoPlatillos = platillos.reduce((s, p) => s + n(p?.cantidad) * n(p?.costoUnitario), 0);
    const ingresoEstimado = platillos.reduce((s, p) => s + n(p?.cantidad) * n(p?.precioUnitario), 0);
    const gastosOperativos = (input.gastos || []).reduce((s, g) => s + n(g?.monto), 0);
    const costoTotal = costoPlatillos + gastosOperativos;
    const utilidadEstimada = ingresoEstimado - costoTotal;
    const recaudacion = n(input.recaudacion);
    const utilidadReal = recaudacion - costoTotal;
    const margenReal = recaudacion > 0 ? (utilidadReal / recaudacion) * 100 : 0;
    return {
        cantidadPlatillos,
        gastosOperativos,
        costoPlatillos,
        ingresoEstimado,
        costoTotal,
        utilidadEstimada,
        utilidadReal,
        margenReal,
    };
}

/* ── Ciclo de vida del evento ─────────────────────────────────────────────
   Pendiente ──► Confirmada ──► Terminada
   Terminada es final y SOLO se llega desde Confirmada: es el cierre del
   evento, el momento en que se captura lo realmente recaudado. Vive en
   tblCotizaciones.EstatusEvento (varchar), no en Status (que es el borrado
   lógico del renglón).
──────────────────────────────────────────────────────────────────────── */

export const QUOTE_STATUSES = ['pendiente', 'confirmada', 'terminada'] as const;
export type QuoteStatus = typeof QUOTE_STATUSES[number];

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
    pendiente: 'Pendiente',
    confirmada: 'Confirmada',
    terminada: 'Terminada',
};

/** Lee el estatus crudo de la base; cualquier valor desconocido es Pendiente. */
export function parseQuoteStatus(value: unknown): QuoteStatus {
    return QUOTE_STATUSES.includes(value as QuoteStatus) ? (value as QuoteStatus) : 'pendiente';
}

/** Estatus a los que se puede mover una cotización desde el actual (incluye el propio). */
export function allowedQuoteStatuses(current: unknown): QuoteStatus[] {
    switch (parseQuoteStatus(current)) {
        case 'pendiente':  return ['pendiente', 'confirmada'];
        case 'confirmada': return ['pendiente', 'confirmada', 'terminada'];
        case 'terminada':  return ['terminada'];
    }
}

export function canTransitionQuoteStatus(current: unknown, next: unknown): boolean {
    return allowedQuoteStatuses(current).includes(parseQuoteStatus(next));
}

/**
 * Estatus final que debe guardarse. Si la transición pedida no es válida se
 * conserva el actual: el servidor no confía en lo que manda el cliente.
 */
export function resolveQuoteStatus(current: unknown, requested: unknown): QuoteStatus {
    const next = parseQuoteStatus(requested);
    return canTransitionQuoteStatus(current, next) ? next : parseQuoteStatus(current);
}

/** Evento cerrado: ya tiene recaudación real y utilidad real que valen. */
export function isQuoteClosed(status: unknown): boolean {
    return parseQuoteStatus(status) === 'terminada';
}
