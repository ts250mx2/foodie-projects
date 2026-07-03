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
    cantidad: number;
    costoUnitario: number;   // costo de costeo por platillo
    precioUnitario: number;  // precio de venta por platillo
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
