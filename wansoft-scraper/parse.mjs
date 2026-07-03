// Parsers genéricos de los fragmentos HTML de los reportes de Wansoft.
// Tres formas de render cubren los 21 reportes:
//   - rowReport: 1 tarjeta con filas .rowReport (la mayoría).
//   - twoCard:   2 tarjetas (p.ej. "por orden" / "por platillo"); cada fila se
//                etiqueta con su sección (el <h2> de la tarjeta).
//   - chart:     los datos viven en el series de Highcharts dentro de <script>.
import * as cheerio from 'cheerio';

// ---------- limpieza de valores ----------
export function cleanStr(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}
export function cleanMoney(v) {
  // "$11,283.64" | "13089.0" | "$0.00" -> número
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
export function cleanInt(v) {
  const n = parseInt(String(v ?? '').replace(/[,\s]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}
export function cleanNum(v) {
  const n = Number(String(v ?? '').replace(/[%,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function clean(value, type) {
  switch (type) {
    case 'money': return cleanMoney(value);
    case 'int': return cleanInt(value);
    case 'num': return cleanNum(value);
    default: return cleanStr(value);
  }
}

/** Convierte una fila de celdas (texto) a objeto según las columnas dadas. */
function cellsToRow(cells, columns) {
  const row = {};
  for (let i = 0; i < columns.length; i++) {
    row[columns[i].col] = clean(cells[i], columns[i].type);
  }
  return row;
}

/** Filas de una tarjeta: cada .rowReport -> texto de sus divs hijos directos. */
function rowReportCells($, $card) {
  const out = [];
  $card.find('.rowReport').each((i, el) => {
    const cells = $(el)
      .children('div')
      .map((j, d) => cleanStr($(d).text()))
      .get();
    out.push(cells);
  });
  return out;
}

// ---------- parsers por tipo ----------
function parseRowReport($, def) {
  const rows = [];
  const $card = $('.card').first().length ? $('.card').first() : $.root();
  for (const cells of rowReportCells($, $card)) {
    if (!cells.length) continue;
    rows.push(cellsToRow(cells, def.columns));
  }
  return rows;
}

function parseTwoCard($, def) {
  const rows = [];
  const dataCols = def.columns.slice(1); // la 1ª columna es 'Seccion'
  $('.card').each((ci, card) => {
    const $card = $(card);
    const seccion = cleanStr($card.find('.header h2').first().text());
    for (const cells of rowReportCells($, $card)) {
      if (!cells.length) continue;
      const row = { [def.columns[0].col]: seccion };
      for (let i = 0; i < dataCols.length; i++) {
        row[dataCols[i].col] = clean(cells[i], dataCols[i].type);
      }
      rows.push(row);
    }
  });
  return rows;
}

function parseChart(html, def) {
  // Busca el primer series:[{... "data":[ {x,y,...}, ... ] ...}] con puntos x/y.
  const m = html.match(/"data":\s*\[([^\]]*?\{[^]*?\}[^\]]*?)\]/);
  if (!m) return [];
  const points = m[1].match(/\{[^}]*\}/g) || [];
  const { x, xType, y, yType } = def.chart;
  const rows = [];
  for (const p of points) {
    let obj;
    try { obj = JSON.parse(p); } catch { continue; }
    if (obj.x === undefined && obj.name === undefined) continue;
    rows.push({
      [x]: clean(obj.x ?? obj.name, xType),
      [y]: clean(obj.y, yType),
    });
  }
  return rows;
}

/**
 * Parsea el HTML de un reporte a un arreglo de objetos {columna: valor}.
 * @param {string} html  Fragmento HTML devuelto por el endpoint del reporte.
 * @param {object} def   Definición del reporte (de reports-registry.mjs).
 */
export function parseReport(html, def) {
  if (!html || !html.trim()) return [];
  if (def.kind === 'chart') return parseChart(html, def);
  const $ = cheerio.load(html);
  if (def.kind === 'twoCard') return parseTwoCard($, def);
  return parseRowReport($, def);
}
