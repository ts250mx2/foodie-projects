import * as XLSX from 'xlsx';

export type SalesDishRow = {
    code: string;
    name: string;
    group: string | null;
    quantity: number;
    subtotal: number;
    percentage: number;
};

export type SalesDishReport = {
    startDate: string;
    endDate: string;
    branch: string;
    rows: SalesDishRow[];
};

export type DishCandidate = { IdProducto: number; Producto: string; Codigo: string | null };

export function normalizeDishText(value: unknown) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function diceSimilarity(left: string, right: string) {
    if (left === right) return 1;
    if (left.length < 2 || right.length < 2) return 0;
    const pairs = new Map<string, number>();
    for (let index = 0; index < left.length - 1; index += 1) {
        const pair = left.slice(index, index + 2);
        pairs.set(pair, (pairs.get(pair) || 0) + 1);
    }
    let matches = 0;
    for (let index = 0; index < right.length - 1; index += 1) {
        const pair = right.slice(index, index + 2);
        const count = pairs.get(pair) || 0;
        if (count > 0) {
            matches += 1;
            pairs.set(pair, count - 1);
        }
    }
    return (2 * matches) / (left.length + right.length - 2);
}

export function suggestDish(code: string, name: string, dishes: DishCandidate[]) {
    const normalizedCode = normalizeDishText(code).replace(/\s/g, '');
    const normalizedName = normalizeDishText(name);
    let best: { dish: DishCandidate; confidence: number; kind: 'codigo' | 'nombre' | 'sugerida' } | null = null;

    for (const dish of dishes) {
        const dishCode = normalizeDishText(dish.Codigo).replace(/\s/g, '');
        const dishName = normalizeDishText(dish.Producto);
        let confidence = 0;
        let kind: 'codigo' | 'nombre' | 'sugerida' = 'sugerida';
        if (normalizedCode && dishCode && normalizedCode === dishCode) {
            confidence = 1; kind = 'codigo';
        } else if (normalizedName && normalizedName === dishName) {
            confidence = 0.99; kind = 'nombre';
        } else {
            confidence = diceSimilarity(normalizedName, dishName) * 0.92;
        }
        if (!best || confidence > best.confidence) best = { dish, confidence, kind };
    }
    // Por debajo de 70% abundan falsos positivos en catálogos reales
    // (por ejemplo, nombres de proteínas con terminaciones parecidas).
    return best && best.confidence >= 0.70 ? best : null;
}

function isoDate(year: string, month: string, day: string) {
    const value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? null : value;
}

export function extractSalesDishReport(workbook: XLSX.WorkBook): SalesDishReport | null {
    const summarySheet = workbook.Sheets.Resumen;
    const salesSheet = workbook.Sheets['Resumen de Ventas'];
    if (!summarySheet || !salesSheet) return null;

    const summaryRows = XLSX.utils.sheet_to_json<unknown[]>(summarySheet, { header: 1, defval: null, raw: true });
    let startDate: string | null = null;
    let endDate: string | null = null;
    let branch = '';
    for (const row of summaryRows) {
        for (const value of row) {
            const text = String(value ?? '').trim();
            const range = text.match(/Del\s+(\d{4})[-/]([01]?\d)[-/]([0-3]?\d)\s+al\s+(\d{4})[-/]([01]?\d)[-/]([0-3]?\d)/i);
            if (range) {
                startDate = isoDate(range[1], range[2], range[3]);
                endDate = isoDate(range[4], range[5], range[6]);
                continue;
            }
            if (!branch && text && !/^Ventas por Sucursal$/i.test(text) && !/^20\d{2}[-/]\d{2}[-/]\d{2}/.test(text)) {
                const hasRangeNearby = row.some(cell => /Del\s+\d{4}/i.test(String(cell ?? '')));
                if (!hasRangeNearby && summaryRows.indexOf(row) >= 3 && summaryRows.indexOf(row) <= 4) branch = text;
            }
        }
    }
    // En los reportes Wansoft la sucursal aparece inmediatamente debajo del rango.
    const flatSummary = summaryRows.flat().map(value => String(value ?? '').trim()).filter(Boolean);
    const rangeIndex = flatSummary.findIndex(value => /^Del\s+\d{4}/i.test(value));
    if (rangeIndex >= 0 && flatSummary[rangeIndex + 1]) branch = flatSummary[rangeIndex + 1];
    if (!startDate || !endDate) return null;

    const salesRows = XLSX.utils.sheet_to_json<unknown[]>(salesSheet, { header: 1, defval: null, raw: true });
    const headerIndex = salesRows.findIndex(row => row.some(value => String(value ?? '').trim() === 'Clave Platillo/Artículo'));
    if (headerIndex < 0) return null;
    const header = salesRows[headerIndex].map(value => String(value ?? '').trim());
    const codeColumn = header.indexOf('Clave Platillo/Artículo');
    const nameColumn = header.indexOf('Nombre Platillo/Artículo', codeColumn + 1);
    const groupColumn = header.indexOf('Grupo', nameColumn + 1);
    const quantityColumn = header.indexOf('Cantidad', groupColumn + 1);
    const subtotalColumn = header.indexOf('Subtotal', quantityColumn + 1);
    const percentageColumn = header.indexOf('%', subtotalColumn + 1);
    if ([codeColumn, nameColumn, quantityColumn, subtotalColumn].some(index => index < 0)) return null;

    const rows: SalesDishRow[] = [];
    for (const row of salesRows.slice(headerIndex + 1)) {
        const code = String(row[codeColumn] ?? '').trim();
        const name = String(row[nameColumn] ?? '').trim();
        const quantity = Number(row[quantityColumn]) || 0;
        const subtotal = Number(row[subtotalColumn]) || 0;
        if ((!code && !name) || (quantity === 0 && subtotal === 0)) continue;
        rows.push({
            code,
            name,
            group: groupColumn >= 0 ? String(row[groupColumn] ?? '').trim() || null : null,
            quantity,
            subtotal,
            percentage: percentageColumn >= 0 ? Number(row[percentageColumn]) || 0 : 0,
        });
    }
    return rows.length ? { startDate, endDate, branch, rows } : null;
}
