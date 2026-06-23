// Módulo de autenticación reusable para Wansoft.
import { chromium } from 'playwright';

const BASE = (process.env.WANSOFT_URL || 'https://www.wansoft.net/Wansoft.Web/').replace(/\/+$/, '/');

export async function launchBrowser() {
  const headful = process.env.HEADFUL === '1';
  const browser = await chromium.launch({ headless: !headful });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  });
  ctx.setDefaultTimeout(60000);
  return { browser, ctx };
}

/** Inicia sesión y deja la página en el Escritorio (/Reports/Dashboard). */
export async function login(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.fill('#UserName', process.env.WANSOFT_USER);
  await page.fill('#Password', process.env.WANSOFT_PASS);
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('input[type=submit][value="Ingresar"]'),
  ]);
  // Verificar que entramos (la URL cambia a /Reports/Dashboard).
  if (/\/Account\/Login/i.test(page.url()) || (await page.locator('#Password').count())) {
    throw new Error('Login falló: seguimos en la pantalla de acceso. Revisa credenciales.');
  }
  // Cerrar posible modal promocional.
  await dismissModal(page);
  return page;
}

/** Cierra modales/popups promocionales si aparecen. */
export async function dismissModal(page) {
  const closers = [
    '.modal.show .close',
    '.modal.in .close',
    'button[aria-label="Close"]',
    '.modal-header .close',
    'a:has-text("Después")',
    'button:has-text("Después")',
  ];
  for (const sel of closers) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) {
      await el.click({ timeout: 2000 }).catch(() => {});
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
}

export const REPORT_URL = BASE + 'Reports/ConsolidatedSalesMasterReport';
