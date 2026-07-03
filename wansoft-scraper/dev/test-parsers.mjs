// Test offline: corre el parser de cada reporte contra el fixture extraído del
// dump y verifica que produzca filas coherentes (sin red ni BD).
import fs from 'node:fs';
import path from 'node:path';
import { REPORTS } from '../reports-registry.mjs';
import { parseReport } from '../parse.mjs';

const DIR = path.resolve(import.meta.dirname, 'fixtures');
let failed = 0;

// Cuántas filas esperamos como mínimo (según lo visto en el dump del 22-jun).
// Los reportes vacíos ese día (sin cancelaciones, etc.) esperan 0 y está bien.
const EXPECT_NONEMPTY = new Set([
  'SalesByPaymentType', 'SalesByGroup', 'SalesByGroupType', 'SalesByArea',
  'SalesByOrder', 'SalesByHour', 'SalesByUser', 'SalesByTerminal',
  'SalesByComplementary', 'SalesBySaucer', 'TipsByUser', 'Promotions',
  'PersonsByHour', 'PersonsByDay', 'PersonsByDayName',
]);

for (const def of REPORTS) {
  const file = path.join(DIR, def.key + '.html');
  const html = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  let rows = [];
  let err = null;
  try {
    rows = parseReport(html, def);
  } catch (e) {
    err = e;
  }

  const colset = new Set(def.columns.map((c) => c.col));
  const sample = rows[0] || {};
  const keysOk = rows.length === 0 || Object.keys(sample).every((k) => colset.has(k));
  const expectRows = EXPECT_NONEMPTY.has(def.key);
  const ok = !err && keysOk && (!expectRows || rows.length > 0);

  if (!ok) failed++;
  const flag = ok ? 'OK ' : 'XX ';
  console.log(`${flag} ${def.key.padEnd(24)} kind=${def.kind.padEnd(9)} rows=${String(rows.length).padStart(3)}  ${err ? 'ERROR ' + err.message : ''}`);
  if (rows.length) {
    console.log('        ' + JSON.stringify(rows[0]));
    if (rows.length > 1) console.log('        ' + JSON.stringify(rows[rows.length - 1]));
  }
}

console.log(`\n${failed === 0 ? 'TODOS OK' : failed + ' FALLARON'} (${REPORTS.length} reportes)`);
process.exit(failed === 0 ? 0 : 1);
