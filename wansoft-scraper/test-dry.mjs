import 'dotenv/config';
import { launchBrowser, login } from './auth.mjs';
import { scrapeSalesByBranch, getBranches, todayMX } from './report.mjs';

const date = process.env.DATE || todayMX();
const limit = Number(process.env.LIMIT || 2);

(async () => {
  const { browser, ctx } = await launchBrowser();
  const page = await ctx.newPage();
  try {
    await login(page);
    console.log('Login OK. Fecha objetivo:', date);

    // Tomar las primeras N sucursales para probar.
    await page.goto((process.env.WANSOFT_URL || '').replace(/\/+$/, '/') + 'Reports/ConsolidatedSalesMasterReport', { waitUntil: 'networkidle' });
    const allBranches = await getBranches(page);
    console.log(`Sucursales disponibles: ${allBranches.length}`);
    console.log(allBranches.map((b) => `  ${b.id} = ${b.name}`).join('\n'));

    const branchIds = allBranches.slice(0, limit).map((b) => b.id);
    const rows = await scrapeSalesByBranch(page, {
      startDate: date,
      endDate: date,
      branchIds,
      onRow: (r) => console.log(`\n>> ${r.sucursal} (${r.idSucursal}) ventas netas total = $${r.ventasNetasTotal}`),
    });
    console.log('\n===== RESULTADO (dry-run) =====');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
    await page.screenshot({ path: 'screenshots/error-dry.png', fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
