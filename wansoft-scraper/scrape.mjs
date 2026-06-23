// Orquestador: login -> ventas por sucursal -> guarda en MySQL (+ alertas).
// Uso:
//   node scrape.mjs                 (hoy, guarda en BD)
//   node scrape.mjs --yesterday     (ayer, para la captura final de cierre)
//   node scrape.mjs --dry           (hoy, NO guarda ni alerta, sólo imprime)
//   DATE=2026-06-22 node scrape.mjs (fecha específica)
import 'dotenv/config';
import { launchBrowser, login } from './auth.mjs';
import { scrapeSalesByBranch, todayMX, yesterdayMX, hourMX } from './report.mjs';
import { getConnection, ensureTable, upsertRow, TABLE } from './db.mjs';
import { sendAlert } from './alert.mjs';

const DRY = process.argv.includes('--dry') || process.env.DRY === '1';
const YESTERDAY = process.argv.includes('--yesterday');
// Hora MX a la que se revisa si alguna sucursal sigue en $0 (posible falla de POS).
const ALERT_ZERO_HOUR = Number(process.env.ALERT_ZERO_HOUR ?? 15);

function log(...a) {
  console.log(new Date().toISOString(), ...a);
}

/** Revisa sucursales en $0 a la hora configurada y alerta si las hay. */
async function checkZeroBranches(rows, date) {
  if (DRY) return;
  if (date !== todayMX()) return;          // solo el día en curso
  if (hourMX() !== ALERT_ZERO_HOUR) return; // solo a la hora configurada
  const zeros = rows.filter((r) => r.ventasNetasTotal === 0);
  if (zeros.length === 0) return;
  const lista = zeros.map((r) => `  - ${r.sucursal}`).join('\n');
  await sendAlert(
    `Sucursales en $0 a las ${ALERT_ZERO_HOUR}:00 (${date})`,
    `Estas sucursales no registran ventas hoy a las ${ALERT_ZERO_HOUR}:00 (revisar POS/sincronización):\n\n${lista}`
  );
}

export async function runOnce() {
  const date = YESTERDAY ? yesterdayMX() : (process.env.DATE || todayMX());
  log(`== Inicio. Fecha=${date} DRY=${DRY} ${YESTERDAY ? '(cierre día anterior)' : ''} ==`);

  const { browser, ctx } = await launchBrowser();
  const page = await ctx.newPage();
  let conn = null;
  try {
    await login(page);
    log('Login OK');

    if (!DRY) {
      conn = await getConnection();
      await ensureTable(conn);
    }

    const rows = await scrapeSalesByBranch(ctx, page, {
      startDate: date,
      endDate: date,
      onRow: async (r) => {
        if (!DRY && conn) await upsertRow(conn, r);
        log(`  ${r.sucursal.padEnd(28)} netas=$${r.ventasNetasTotal.toFixed(2)}  brutas=$${r.ventasBrutasTotal.toFixed(2)}`);
      },
    });

    const total = rows.reduce((s, r) => s + r.ventasNetasTotal, 0);
    log(`== Fin. ${rows.length} sucursales. Total ventas netas del día = $${total.toFixed(2)} ==`);
    if (!DRY) log(`Guardado en ${process.env.DB_NAME}.${TABLE}`);

    await checkZeroBranches(rows, date);
    return rows;
  } catch (err) {
    log('ERROR FATAL:', err.message);
    if (!DRY) {
      await sendAlert(
        'Falló la captura horaria',
        `La captura de Wansoft falló para la fecha ${date}.\n\nError: ${err.message}\n\nHora servidor: ${new Date().toISOString()}`
      );
    }
    throw err;
  } finally {
    if (conn) await conn.end().catch(() => {});
    await browser.close().catch(() => {});
  }
}

// Permite ejecutarlo directamente o importarlo (scheduler).
if (process.argv[1]?.endsWith('scrape.mjs')) {
  runOnce().catch(() => process.exit(1));
}
