import 'dotenv/config';
import { launchBrowser, login } from './auth.mjs';

const BASE = (process.env.WANSOFT_URL || '').replace(/\/+$/, '/');
const SUB = '5605'; // Polleria 73

async function getConsolidated(ctx, sub, startDate, endDate) {
  const url = `${BASE}Reports/GetConsolidatedSales?subsidiaryId=${sub}&startDate=${startDate}&endDate=${endDate}`;
  const res = await ctx.request.post(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  const status = res.status();
  let body;
  try { body = await res.json(); } catch { body = (await res.text()).slice(0, 200); }
  return { status, body };
}

(async () => {
  const { browser, ctx } = await launchBrowser();
  const page = await ctx.newPage();
  try {
    await login(page);
    const cases = [
      ['2026-06-23', '2026-06-23'],
      ['2026-06-22', '2026-06-22'],
      ['2026-06-21', '2026-06-21'],
      ['2026-06-01', '2026-06-30'],
    ];
    for (const [s, e] of cases) {
      const { status, body } = await getConsolidated(ctx, SUB, s, e);
      const t = typeof body === 'object' ? body.TotalSales : body;
      const g = typeof body === 'object' ? body.TotalGrossSales : '';
      console.log(`${s}..${e}  status=${status}  TotalSales=${t}  TotalGross=${g}`);
    }
    // Volcado completo de un caso para ver todos los campos
    const { body } = await getConsolidated(ctx, SUB, '2026-06-22', '2026-06-22');
    console.log('\nJSON completo (2026-06-22):\n', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await browser.close();
  }
})();
