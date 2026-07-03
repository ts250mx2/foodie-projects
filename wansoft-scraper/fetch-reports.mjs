// Obtiene el fragmento HTML de un reporte de Wansoft (mismo endpoint AJAX que usa
// el portal) y lo parsea a filas estructuradas usando el registry.
import { REPORTS } from './reports-registry.mjs';
import { parseReport } from './parse.mjs';

const BASE = (process.env.WANSOFT_URL || 'https://www.wansoft.net/Wansoft.Web/').replace(/\/+$/, '/');

/**
 * Pide un reporte para una sucursal y rango, y devuelve sus filas parseadas.
 * @param ctx          BrowserContext de Playwright con sesión iniciada.
 * @param def          Definición del reporte (reports-registry.mjs).
 * @param subsidiaryId Id de la sucursal en Wansoft.
 */
export async function fetchReport(ctx, def, subsidiaryId, startDate, endDate) {
  const url = `${BASE}${def.endpoint}?subsidiaryId=${subsidiaryId}&startDate=${startDate}&endDate=${endDate}`;
  const res = await ctx.request.post(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  if (res.status() !== 200) {
    throw new Error(`${def.key} HTTP ${res.status()}`);
  }
  const html = await res.text();
  return parseReport(html, def);
}

/**
 * Recorre todos los reportes para una sucursal/rango.
 * @param onReport callback async (def, rows) por cada reporte (para guardar).
 * @returns resumen { key: filas }.
 */
export async function fetchAllReports(ctx, subsidiaryId, startDate, endDate, onReport) {
  const summary = {};
  for (const def of REPORTS) {
    try {
      const rows = await fetchReport(ctx, def, subsidiaryId, startDate, endDate);
      summary[def.key] = rows.length;
      if (onReport) await onReport(def, rows);
    } catch (err) {
      // Un reporte opcional sin servicio (p.ej. Megapuntos) no debe abortar todo.
      summary[def.key] = def.optional ? 0 : `ERR:${err.message}`;
      if (!def.optional) throw err;
    }
  }
  return summary;
}
