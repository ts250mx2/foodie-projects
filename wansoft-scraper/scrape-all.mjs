// Orquestador COMPLETO: login -> por cada sucursal trae el resumen consolidado
// (tblWansoftVentasSucursal) + los 21 reportes (una tabla por reporte) y los
// guarda en MySQL. Es el job que dispara el cron y el botón "Sincronizar ahora".
//
// Uso:
//   node scrape-all.mjs                  (hoy, guarda en BD)
//   node scrape-all.mjs --yesterday      (cierre del día anterior)
//   node scrape-all.mjs --dry            (no guarda, sólo imprime resumen)
//   node scrape-all.mjs --branch=123     (una sola sucursal)
//   node scrape-all.mjs --only=SalesByGroup,SalesByUser
//   DATE=2026-06-22 node scrape-all.mjs  (fecha específica)
//
// Imprime al final una línea "SUMMARY <json>" que el API web puede leer.
import 'dotenv/config';
import { launchBrowser, login } from './auth.mjs';
import {
  getBranches, getConsolidatedSales, consolidatedToRow, todayMX, yesterdayMX,
} from './report.mjs';
import { getConnection, ensureTable, upsertRow } from './db.mjs';
import { ensureReportTable, refreshReport } from './reports-db.mjs';
import { REPORTS } from './reports-registry.mjs';
import { fetchReport } from './fetch-reports.mjs';
import { sendAlert } from './alert.mjs';

const DRY = process.argv.includes('--dry') || process.env.DRY === '1';
const YESTERDAY = process.argv.includes('--yesterday');
const argBranch = process.argv.find((a) => a.startsWith('--branch='));
const BRANCH = argBranch ? argBranch.split('=')[1] : (process.env.BRANCH || null);
const argOnly = process.argv.find((a) => a.startsWith('--only='));
const ONLY = argOnly ? argOnly.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean) : null;

function log(...a) {
  console.log(new Date().toISOString(), ...a);
}

export async function runAll() {
  const date = YESTERDAY ? yesterdayMX() : (process.env.DATE || todayMX());
  const reportsToRun = ONLY ? REPORTS.filter((r) => ONLY.includes(r.key)) : REPORTS;
  log(`== Inicio COMPLETO. Fecha=${date} DRY=${DRY} reportes=${reportsToRun.length}${BRANCH ? ` sucursal=${BRANCH}` : ''} ==`);

  const { browser, ctx } = await launchBrowser();
  const page = await ctx.newPage();
  let conn = null;
  const summary = { fecha: date, sucursales: 0, consolidado: 0, reportes: {}, errores: [] };

  try {
    await login(page);
    log('Login OK');

    if (!DRY) {
      conn = await getConnection();
      await ensureTable(conn);                 // consolidado (existente)
      for (const def of reportsToRun) await ensureReportTable(conn, def);
    }

    let branches = await getBranches(page);
    if (BRANCH) branches = branches.filter((b) => String(b.id) === String(BRANCH));
    if (!branches.length) throw new Error('No se encontraron sucursales (revisa --branch o la sesión).');

    const capturadoEn = new Date();

    for (const b of branches) {
      const idSucursal = Number(b.id);
      // 1) Resumen consolidado de ventas (tblWansoftVentasSucursal).
      try {
        const j = await getConsolidatedSales(ctx, b.id, date, date);
        const row = consolidatedToRow(b, date, j);
        if (!DRY && conn) await upsertRow(conn, row);
        summary.consolidado += row.ventasNetasTotal;
        log(`  ${b.name.padEnd(26)} consolidado netas=$${row.ventasNetasTotal.toFixed(2)}`);
      } catch (err) {
        summary.errores.push(`${b.name}/consolidado: ${err.message}`);
        log(`  ${b.name} consolidado ERROR: ${err.message}`);
      }

      // 2) Todos los reportes (una tabla por reporte).
      for (const def of reportsToRun) {
        try {
          const rows = await fetchReport(ctx, def, b.id, date, date);
          if (!DRY && conn) {
            await refreshReport(conn, def, { fecha: date, idSucursal, sucursal: b.name, capturadoEn }, rows);
          }
          summary.reportes[def.key] = (summary.reportes[def.key] || 0) + rows.length;
        } catch (err) {
          if (def.optional) {
            summary.reportes[def.key] = summary.reportes[def.key] || 0;
          } else {
            summary.errores.push(`${b.name}/${def.key}: ${err.message}`);
            log(`  ${b.name} ${def.key} ERROR: ${err.message}`);
          }
        }
      }
      summary.sucursales++;
    }

    const totalFilas = Object.values(summary.reportes).reduce((s, n) => s + (Number(n) || 0), 0);
    log(`== Fin. ${summary.sucursales} sucursales, ${reportsToRun.length} reportes, ${totalFilas} filas de reporte. Consolidado=$${summary.consolidado.toFixed(2)} ==`);
    if (summary.errores.length) log(`Errores: ${summary.errores.length}`);
    console.log('SUMMARY ' + JSON.stringify(summary));
    return summary;
  } catch (err) {
    log('ERROR FATAL:', err.message);
    if (!DRY) {
      await sendAlert(
        'Falló la sincronización completa de Wansoft',
        `La sincronización completa falló para la fecha ${date}.\n\nError: ${err.message}\n\nHora servidor: ${new Date().toISOString()}`
      ).catch(() => {});
    }
    console.log('SUMMARY ' + JSON.stringify({ ...summary, fatal: err.message }));
    throw err;
  } finally {
    if (conn) await conn.end().catch(() => {});
    await browser.close().catch(() => {});
  }
}

if (process.argv[1]?.endsWith('scrape-all.mjs')) {
  runAll().catch(() => process.exit(1));
}
