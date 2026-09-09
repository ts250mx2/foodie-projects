/**
 * Unidades y porciones de un producto.
 *
 * REGLA CENTRAL: cada producto tiene UNA unidad base — la más chica con la que
 * se mueve en la operación — y el almacén guarda existencia y costo promedio
 * SIEMPRE en esa unidad. Todo lo demás son presentaciones con un factor: "1
 * BOTE = 3700 GRAMO". Cada captura (compra, requisición, merma, ajuste) elige
 * cantidad + presentación y se convierte a base al guardar el movimiento.
 *
 * Sin esto el costo promedio no significa nada: entra un bote de aderezo a
 * $200 con existencia 1 y sale un pedido de 100 gramos restando 100, dejando
 * existencia -99 y una salida costeada en $20,000.
 *
 * Un producto SIN presentaciones configuradas usa factor 1 en todo, así que se
 * comporta exactamente como antes de existir este módulo: la adopción es
 * producto por producto, sin migración forzada.
 *
 * Módulo puro (sin React ni mysql): lo usan el cliente para mostrar la
 * conversión en vivo y el servidor para convertir antes de guardar.
 */

export interface ProductUnit {
    /** Etiqueta que ve el usuario: GRAMO, BOTE, CAJA… */
    unidad: string;
    /** Cuántas unidades BASE es una de esta. La base siempre vale 1. */
    factor: number;
    esBase: boolean;
    /** Preseleccionada al comprar. */
    esCompra: boolean;
    /** Preseleccionada al pedir (requisiciones). */
    esPedido: boolean;
}

/** Normaliza el nombre de una unidad para poder compararlas sin sorpresas. */
export function normalizeUnit(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .toUpperCase()
        .slice(0, 30);
}

/** La unidad base del producto; null si no tiene presentaciones configuradas. */
export function baseUnit(units: ProductUnit[]): ProductUnit | null {
    return units.find(u => u.esBase) ?? null;
}

/**
 * Factor de una unidad hacia la base. Devuelve 1 cuando el producto no tiene
 * presentaciones o la unidad capturada no está entre ellas: en ese caso el
 * movimiento se guarda tal cual, igual que antes.
 */
export function unitFactor(units: ProductUnit[], unidad: unknown): number {
    if (units.length === 0) return 1;
    const target = normalizeUnit(unidad);
    if (!target) return baseUnit(units)?.factor ?? 1;
    const found = units.find(u => normalizeUnit(u.unidad) === target);
    return found && found.factor > 0 ? found.factor : 1;
}

/**
 * Unidad en la que se entiende una captura que no dijo cuál usó.
 *
 * La captura de compras no pregunta la unidad: se entiende que se compró en la
 * presentación de compra ("3 botes"), igual que la requisición se entiende en
 * la de pedido. Sin presentaciones configuradas devuelve null y no se convierte
 * nada.
 */
export function defaultCaptureUnit(
    units: ProductUnit[],
    intencion: 'compra' | 'pedido' | 'base'
): string | null {
    if (units.length === 0) return null;
    const base = baseUnit(units);
    if (intencion === 'base') return base?.unidad ?? null;
    const preferida = intencion === 'compra'
        ? units.find(u => u.esCompra)
        : units.find(u => u.esPedido);
    return (preferida ?? base)?.unidad ?? null;
}

/** Convierte una cantidad capturada en `unidad` a la unidad base. */
export function toBaseQuantity(units: ProductUnit[], cantidad: number, unidad: unknown): number {
    const qty = Number(cantidad);
    if (!Number.isFinite(qty)) return 0;
    return qty * unitFactor(units, unidad);
}

/**
 * Convierte un costo POR unidad capturada a costo por unidad base.
 * El bote de $200 con factor 3700 cuesta $0.054054 por gramo.
 */
export function toBaseUnitCost(units: ProductUnit[], costoUnitario: number, unidad: unknown): number {
    const cost = Number(costoUnitario);
    if (!Number.isFinite(cost)) return 0;
    const factor = unitFactor(units, unidad);
    return factor > 0 ? cost / factor : cost;
}

/** Convierte una cantidad en base hacia otra presentación (para mostrarla). */
export function fromBaseQuantity(units: ProductUnit[], cantidadBase: number, unidad: unknown): number {
    const factor = unitFactor(units, unidad);
    return factor > 0 ? Number(cantidadBase) / factor : Number(cantidadBase);
}

/** Redondeo de presentación: evita "0.0270000001 botes" en pantalla. */
function tidy(value: number): string {
    if (!Number.isFinite(value)) return '0';
    const abs = Math.abs(value);
    const decimals = abs === 0 ? 0 : abs >= 100 ? 0 : abs >= 1 ? 2 : 4;
    return value.toLocaleString('es-MX', { maximumFractionDigits: decimals });
}

/**
 * Texto de ayuda bajo el campo de captura: "100 GRAMO = 0.027 BOTE".
 * Es lo que hace innecesario que la persona sepa que existe una unidad base.
 */
export function conversionHint(
    units: ProductUnit[],
    cantidad: number,
    unidad: unknown
): string | null {
    const base = baseUnit(units);
    if (!base || units.length < 2) return null;

    const capturada = normalizeUnit(unidad);
    const qty = Number(cantidad);
    if (!Number.isFinite(qty) || qty <= 0) return null;

    const enBase = toBaseQuantity(units, qty, unidad);

    // Capturando en la base: se muestra el equivalente en la presentación de
    // compra, que es como la gente ve el producto en la bodega.
    if (capturada === normalizeUnit(base.unidad)) {
        const compra = units.find(u => u.esCompra && !u.esBase) ?? units.find(u => !u.esBase);
        if (!compra) return null;
        return `${tidy(qty)} ${base.unidad} = ${tidy(fromBaseQuantity(units, enBase, compra.unidad))} ${compra.unidad}`;
    }

    return `${tidy(qty)} ${capturada} = ${tidy(enBase)} ${base.unidad}`;
}

/**
 * Valida un juego de presentaciones antes de guardarlo.
 * Devuelve el primer problema encontrado, o null si está bien.
 */
export function validateUnits(units: ProductUnit[]): string | null {
    if (units.length === 0) return null;

    const bases = units.filter(u => u.esBase);
    if (bases.length !== 1) return 'Debe haber exactamente una unidad base.';
    if (Number(bases[0].factor) !== 1) return 'La unidad base siempre tiene factor 1.';

    const nombres = new Set<string>();
    for (const u of units) {
        const nombre = normalizeUnit(u.unidad);
        if (!nombre) return 'Toda presentación necesita nombre.';
        if (nombres.has(nombre)) return `La unidad "${nombre}" está repetida.`;
        nombres.add(nombre);
        if (!Number.isFinite(u.factor) || u.factor <= 0) {
            return `El factor de "${nombre}" debe ser mayor a cero.`;
        }
    }

    const compras = units.filter(u => u.esCompra).length;
    if (compras > 1) return 'Solo una presentación puede ser la de compra.';
    if (units.filter(u => u.esPedido).length > 1) return 'Solo una presentación puede ser la de pedido.';

    // La captura de compras no pregunta la unidad: si nadie marca cuál es,
    // una compra de "3" se entendería como 3 unidades base — 3 gramos en vez
    // de 3 botes — y el costo promedio quedaría mal.
    if (units.length > 1 && compras === 0) {
        return 'Marca en cuál presentación lo compras ("Así lo compro").';
    }

    return null;
}

/**
 * Presentaciones sugeridas a partir de lo que el catálogo ya tiene capturado
 * (CantidadCompra + UnidadMedidaCompra + UnidadMedidaInventario). Sirve para
 * que configurar un producto sea aceptar una propuesta y no escribir de cero.
 */
export function suggestUnits(producto: {
    UnidadMedidaInventario?: string | null;
    UnidadMedidaCompra?: string | null;
    CantidadCompra?: number | null;
}): ProductUnit[] {
    const inventario = normalizeUnit(producto.UnidadMedidaInventario);
    const compra = normalizeUnit(producto.UnidadMedidaCompra);
    const contenido = Number(producto.CantidadCompra);

    if (!inventario && !compra) return [];

    // La base es la de inventario; si no hay, la de compra.
    const base: ProductUnit = {
        unidad: inventario || compra,
        factor: 1,
        esBase: true,
        esCompra: !inventario || inventario === compra,
        esPedido: true,
    };
    const units = [base];

    // La presentación de compra solo aporta si trae contenido y es distinta.
    if (compra && compra !== base.unidad && Number.isFinite(contenido) && contenido > 0) {
        units.push({ unidad: compra, factor: contenido, esBase: false, esCompra: true, esPedido: false });
        base.esCompra = false;
    }

    return units;
}
