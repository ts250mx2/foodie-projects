// Explora la página del reporte "Ventas por sucursal" para identificar
// campos de fecha, botón de consultar y la tabla de resultados.
import 'dotenv/config';
import fs from 'node:fs';
import { launchBrowser, login, dismissModal, REPORT_URL } from './auth.mjs';

fs.mkdirSync('screenshots', { recursive: true });
fs.mkdirSync('dumps', { recursive: true });
const log = (...a) => console.log(...a);

(async () => {
  const { browser, ctx } = await launchBrowser();
  const page = await ctx.newPage();
  try {
    await login(page);
    log('Login OK, en', page.url());

    log('Navegando al reporte:', REPORT_URL);
    await page.goto(REPORT_URL, { waitUntil: 'networkidle' });
    await dismissModal(page);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/10-report.png', fullPage: true });
    fs.writeFileSync('dumps/10-report.html', await page.content());

    const form = await page.evaluate(() => {
      const pick = (el) => ({
        tag: el.tagName,
        type: el.getAttribute('type'),
        id: el.id || null,
        name: el.getAttribute('name'),
        class: el.getAttribute('class'),
        placeholder: el.getAttribute('placeholder'),
        value: el.value,
        text: (el.innerText || el.value || '').trim().slice(0, 50),
      });
      return {
        title: document.title,
        url: location.href,
        inputs: [...document.querySelectorAll('input')].map(pick),
        selects: [...document.querySelectorAll('select')].map((s) => ({
          id: s.id, name: s.name, class: s.className,
          options: [...s.options].map((o) => ({ value: o.value, text: o.text })).slice(0, 10),
        })),
        buttons: [...document.querySelectorAll('button, input[type=submit], input[type=button], a.btn')].map(pick),
        tables: [...document.querySelectorAll('table')].map((t) => ({
          id: t.id, class: t.className, rows: t.rows.length,
          firstRow: t.rows[0] ? t.rows[0].innerText.slice(0, 120) : null,
        })),
      };
    });
    log('\n===== REPORT FORM =====');
    log('INPUTS:', JSON.stringify(form.inputs, null, 2));
    log('SELECTS:', JSON.stringify(form.selects, null, 2));
    log('BUTTONS:', JSON.stringify(form.buttons, null, 2));
    log('TABLES:', JSON.stringify(form.tables, null, 2));
  } catch (err) {
    log('ERROR:', err.message);
    await page.screenshot({ path: 'screenshots/error-report.png', fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
