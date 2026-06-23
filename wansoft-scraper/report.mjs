// Lógica del reporte "Ventas por sucursal" (ConsolidatedSalesMasterReport).
// En vez de pelear con el datepicker del UI, llamamos directamente al endpoint
// AJAX que el propio reporte usa: Reports/GetConsolidatedSales, que respeta
// subsidiaryId + startDate + endDate y devuelve JSON limpio.
import { REPORT_URL } from './auth.mjs';

const BASE = (process.env.WANSOFT_URL || 'https://www.wansoft.net/Wansoft.Web/').replace(/\/+$/, '/');

/** 'YYYY-MM-DD' para una fecha dada en zona horaria de México. */
function ymdMX(date) {
  // en-CA produce el formato YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/** 'YYYY-MM-DD' para hoy en zona horaria de México. */
export function todayMX() {
  return ymdMX(new Date());
}

/** 'YYYY-MM-DD' para ayer en zona horaria de México. */
export function yesterdayMX() {
  return ymdMX(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

/** Hora (0-23) actual en zona horaria de México. */
export function hourMX() {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit', hour12: false,
    }).format(new Date())
  );
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Lee la lista de sucursales del selector del reporte (id + nombre). */
export async function getBranches(page) {
  await page.goto(REPORT_URL, { waitUntil: 'domcontentloaded' });
  // El selectpicker oculta el <select> original; esperamos a que exista en el DOM.
  await page.waitForSelector('#Subsidiary option', { state: 'attached', timeout: 60000 });
  return page.$$eval('#Subsidiary option', (opts) =>
    opts
      .map((o) => ({ id: o.value, name: (o.textContent || '').trim() }))
      .filter((o) => o.id && o.name)
  );
}

/** Llama al endpoint de resumen consolidado para una sucursal y rango. */
export async function getConsolidatedSales(ctx, subsidiaryId, startDate, endDate) {
  const url = `${BASE}Reports/GetConsolidatedSales?subsidiaryId=${subsidiaryId}&startDate=${startDate}&endDate=${endDate}`;
  const res = await ctx.request.post(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  if (res.status() !== 200) {
    throw new Error(`GetConsolidatedSales ${subsidiaryId} HTTP ${res.status()}`);
  }
  const j = await res.json();
  if (j.MessageType !== 1) {
    throw new Error(`GetConsolidatedSales ${subsidiaryId} MessageType=${j.MessageType}`);
  }
  return j;
}

/** Convierte el JSON del endpoint a la fila que guardamos. */
function toRow(branch, fecha, j) {
  return {
    fecha,
    idSucursal: Number(branch.id),
    sucursal: branch.name,
    ventasBrutasSubtotal: num(j.SubtotalGrossSales),
    ventasBrutasIva: num(j.IvaGrossSales),
    ventasBrutasTotal: num(j.TotalGrossSales),
    cortesias: num(j.TotalCourtesies),
    descuentos: num(j.TotalDiscount),
    promociones: num(j.TotalPromotion),
    cancelaciones: num(j.TotalCancelSales),
    anulaciones: num(j.TotalNullification),
    ventasNetasSubtotal: num(j.SubtotalSales),
    ventasNetasIva: num(j.IvaSales),
    ventasNetasTotal: num(j.TotalSales),
    capturadoEn: new Date(),
  };
}

/**
 * Recorre las sucursales (o un subconjunto) y devuelve el resumen de ventas
 * de cada una para [startDate, endDate].
 * @param ctx  BrowserContext con sesión iniciada (para las peticiones).
 * @param page Page con sesión (para leer la lista de sucursales).
 */
export async function scrapeSalesByBranch(ctx, page, { startDate, endDate, branchIds = null, onRow = null } = {}) {
  let branches = await getBranches(page);
  if (branchIds && branchIds.length) {
    const wanted = new Set(branchIds.map(String));
    branches = branches.filter((b) => wanted.has(String(b.id)));
  }

  const rows = [];
  for (const b of branches) {
    const j = await getConsolidatedSales(ctx, b.id, startDate, endDate);
    const row = toRow(b, startDate, j);
    rows.push(row);
    if (onRow) await onRow(row);
  }
  return rows;
}
