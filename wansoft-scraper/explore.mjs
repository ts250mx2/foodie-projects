// Corrida exploratoria: inicia sesión en Wansoft y captura pantallas + HTML
// para identificar selectores reales del login y del reporte.
import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = process.env.WANSOFT_URL;
const USER = process.env.WANSOFT_USER;
const PASS = process.env.WANSOFT_PASS;
const HEADFUL = process.env.HEADFUL === '1';

fs.mkdirSync('screenshots', { recursive: true });
fs.mkdirSync('dumps', { recursive: true });

const log = (...a) => console.log(...a);

async function describeForm(page, tag) {
  const data = await page.evaluate(() => {
    const pick = (el) => ({
      tag: el.tagName,
      type: el.getAttribute('type'),
      id: el.id || null,
      name: el.getAttribute('name'),
      placeholder: el.getAttribute('placeholder'),
      value: el.tagName === 'INPUT' ? el.value : undefined,
      text: (el.innerText || el.value || '').trim().slice(0, 60),
    });
    const inputs = [...document.querySelectorAll('input')].map(pick);
    const buttons = [...document.querySelectorAll('button, input[type=submit], input[type=button], a.btn')].map(pick);
    const frames = [...document.querySelectorAll('iframe')].map((f) => ({ src: f.src, id: f.id, name: f.name }));
    return { inputs, buttons, frames, title: document.title, url: location.href };
  });
  log(`\n===== [${tag}] ${data.title} -> ${data.url}`);
  log('INPUTS:', JSON.stringify(data.inputs, null, 2));
  log('BUTTONS:', JSON.stringify(data.buttons, null, 2));
  if (data.frames.length) log('IFRAMES:', JSON.stringify(data.frames, null, 2));
  return data;
}

async function dumpLinks(page, tag) {
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a, [role=menuitem], .menu-item, li')]
      .map((a) => ({ text: (a.innerText || '').trim().slice(0, 50), href: a.getAttribute('href') || null }))
      .filter((l) => l.text && l.text.length > 1)
      .slice(0, 200)
  );
  log(`\n===== LINKS/MENU [${tag}] (${links.length}) =====`);
  log(JSON.stringify(links, null, 2));
}

(async () => {
  const browser = await chromium.launch({ headless: !HEADFUL });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'es-MX',
  });
  const page = await ctx.newPage();
  page.on('console', (m) => log('  [page]', m.type(), m.text().slice(0, 200)));

  try {
    log('Abriendo', URL);
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.screenshot({ path: 'screenshots/01-landing.png', fullPage: true });
    fs.writeFileSync('dumps/01-landing.html', await page.content());
    await describeForm(page, 'landing');

    // Heurística de login: campo password + el texto anterior como usuario.
    const pwd = page.locator('input[type=password]').first();
    if (await pwd.count()) {
      const userField = page
        .locator('input[type=text], input[type=email], input:not([type])')
        .first();
      log('\nIntentando llenar credenciales...');
      await userField.fill(USER);
      await pwd.fill(PASS);
      await page.screenshot({ path: 'screenshots/02-filled.png', fullPage: true });

      // Buscar botón de submit
      const submit = page
        .locator('button[type=submit], input[type=submit], button:has-text("Entrar"), button:has-text("Iniciar"), input[value*="Entrar" i], input[value*="Iniciar" i], a:has-text("Entrar")')
        .first();
      if (await submit.count()) {
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {}),
          submit.click(),
        ]);
      } else {
        log('No encontré botón submit; intento Enter en password.');
        await pwd.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
      }

      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'screenshots/03-after-login.png', fullPage: true });
      fs.writeFileSync('dumps/03-after-login.html', await page.content());
      await describeForm(page, 'after-login');
      await dumpLinks(page, 'after-login');
    } else {
      log('No hay campo password en la primera pantalla; revisar 01-landing.png / iframes.');
    }
  } catch (err) {
    log('ERROR:', err.message);
    await page.screenshot({ path: 'screenshots/error.png', fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
