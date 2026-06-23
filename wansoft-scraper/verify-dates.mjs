import 'dotenv/config';
import { launchBrowser, login } from './auth.mjs';
import { scrapeSalesByBranch } from './report.mjs';

const BRANCH = '5605'; // Polleria 73
const cases = [
  { label: 'HOY (2026-06-22)', startDate: '2026-06-22', endDate: '2026-06-22' },
  { label: 'AYER (2026-06-21)', startDate: '2026-06-21', endDate: '2026-06-21' },
  { label: '01..15 junio', startDate: '2026-06-01', endDate: '2026-06-15' },
  { label: 'MES 01..30', startDate: '2026-06-01', endDate: '2026-06-30' },
];

(async () => {
  const { browser, ctx } = await launchBrowser();
  const page = await ctx.newPage();
  try {
    await login(page);
    for (const c of cases) {
      const [row] = await scrapeSalesByBranch(page, {
        startDate: c.startDate, endDate: c.endDate, branchIds: [BRANCH],
      });
      // leer los inputs de fecha reales tras aplicar, para confirmar que tomaron
      const applied = await page.evaluate(() => ({
        start: document.getElementById('startDate')?.value,
        end: document.getElementById('endDate')?.value,
        subsidiary: document.getElementById('Subsidiary')?.value,
      }));
      console.log(`${c.label.padEnd(22)} -> netas $${row.ventasNetasTotal}  | inputs: ${applied.start}..${applied.end} suc=${applied.subsidiary}`);
    }
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await browser.close();
  }
})();
