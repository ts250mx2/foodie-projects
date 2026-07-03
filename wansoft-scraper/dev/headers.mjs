// Dev helper: imprime título (h2) y encabezados <strong> por card de cada fixture,
// y muestra la primera fila de datos (rowReport) para diseñar columnas.
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const DIR = path.resolve(import.meta.dirname, 'fixtures');
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.html'))) {
  const $ = cheerio.load(fs.readFileSync(path.join(DIR, file), 'utf8'));
  console.log('\n=== ' + file.replace('.html', '') + ' ===');
  $('.card').each((ci, card) => {
    const $c = $(card);
    const title = $c.find('.header h2').first().text().trim();
    // fila de encabezado = primera .row.clearfix con <strong>
    let headerLabels = [];
    $c.find('.row.clearfix').each((i, r) => {
      const strs = $(r).find('strong');
      if (strs.length && !headerLabels.length) {
        headerLabels = $(r).children('div').map((j, d) => $(d).text().trim().replace(/\s+/g, ' ')).get();
      }
    });
    const firstRow = $c.find('.rowReport').first();
    const firstCells = firstRow.length
      ? firstRow.children('div').map((j, d) => $(d).text().trim().replace(/\s+/g, ' ')).get()
      : [];
    console.log(`  card[${ci}] title="${title}"`);
    console.log(`    headers(${headerLabels.length}): ${JSON.stringify(headerLabels)}`);
    console.log(`    firstRow(${firstCells.length}): ${JSON.stringify(firstCells)}`);
  });
  // ¿hay highcharts con series de datos?
  const scripts = $('script').map((i, s) => $(s).html() || '').get().join('\n');
  const m = scripts.match(/series:\s*\[\s*\{[^]*?"data":\s*\[([^\]]*)\]/);
  if (m) console.log('    [chart] data sample: ' + m[1].slice(0, 160));
}
