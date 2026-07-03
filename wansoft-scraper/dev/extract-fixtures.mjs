// Dev helper: extrae el HTML renderizado de cada contenedor de reporte del
// dump 10-report.html a fixtures individuales, para diseñar/verificar parsers.
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const ROOT = path.resolve(import.meta.dirname, '..');
const DUMP = path.join(ROOT, 'dumps', '10-report.html');
const OUT = path.join(ROOT, 'dev', 'fixtures');
fs.mkdirSync(OUT, { recursive: true });

const CONTAINERS = [
  'SalesByPaymentType', 'SalesByGroup', 'SalesByGroupType', 'SalesByArea',
  'SalesByOrder', 'SalesByHour', 'SalesByUser', 'SalesByTerminal',
  'SalesByComplementary', 'SalesBySaucer', 'CancelSalesDetail', 'CourtesiesDetail',
  'DiscountsDetail', 'Promotions', 'SaleNullificationDetail', 'TipsByUser',
  'PersonsByHour', 'PersonsByDay', 'PersonsByDayName', 'ChargePaymentMethod',
  'MegaPointsReport',
];

const html = fs.readFileSync(DUMP, 'utf8');
const $ = cheerio.load(html);

const summary = [];
for (const id of CONTAINERS) {
  const el = $('#' + id);
  const inner = el.length ? el.html() || '' : '';
  fs.writeFileSync(path.join(OUT, id + '.html'), inner.trim() + '\n');
  // resumen estructural: cuántas tablas/filas/headers
  const sub = cheerio.load(inner);
  summary.push({
    id,
    bytes: inner.length,
    tables: sub('table').length,
    rows: sub('tr').length,
    firstHeaders: sub('th').map((i, e) => sub(e).text().trim()).get().slice(0, 12),
  });
}
console.log(JSON.stringify(summary, null, 2));
