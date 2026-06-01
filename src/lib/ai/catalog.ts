/**
 * Catálogo DINÁMICO del proyecto logueado.
 *
 * En esta app cada proyecto tiene su propia BD con la misma estructura pero
 * datos distintos: los IDs de canales/terminales/turnos NO son estables entre
 * proyectos, los nombres cambian, y hasta la convención de mes (0-11 vs 1-12)
 * difiere por proyecto/tabla. Este módulo consulta la conexión activa y arma un
 * bloque de texto que se inyecta en el system prompt para que el agente escriba
 * SQL correcto contra ESTE proyecto en particular.
 *
 * Se cachea por proyecto unos minutos porque las dimensiones casi no cambian.
 */

import type { Connection } from 'mysql2/promise';

interface CacheEntry { text: string; expires: number; }
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

// ─── Helpers ────────────────────────────────────────────────────────────────
async function safeRows(conn: Connection, sql: string): Promise<any[]> {
    try {
        const [rows] = await conn.query(sql);
        return Array.isArray(rows) ? (rows as any[]) : [];
    } catch {
        return [];
    }
}

/**
 * Detecta si una tabla guarda Mes como 0-11 o 1-12 comparando el Mes almacenado
 * contra MONTH(<columna de fecha>). Usa voto mayoritario para tolerar ruido.
 */
async function detectMonthConvention(
    conn: Connection, table: string, dateCol: string
): Promise<'0-11' | '1-12' | 'desconocida'> {
    const rows = await safeRows(conn,
        `SELECT Mes AS storedMes, MONTH(${dateCol}) AS realMonth
         FROM \`${table}\`
         WHERE ${dateCol} IS NOT NULL AND Mes IS NOT NULL
         ORDER BY ${dateCol} DESC
         LIMIT 200`
    );
    if (rows.length === 0) return 'desconocida';

    let same = 0, plusOne = 0;
    for (const r of rows) {
        const diff = Number(r.realMonth) - Number(r.storedMes);
        if (diff === 0) same++;
        else if (diff === 1 || diff === -11) plusOne++; // -11 = Dic(11)→Ene? no aplica, guarda
    }
    const total = rows.length;
    if (same / total >= 0.6) return '1-12';
    if (plusOne / total >= 0.6) return '0-11';
    return 'desconocida';
}

function listDim(rows: any[], idKey: string, nameKey: string, extra?: (r: any) => string): string {
    if (rows.length === 0) return '  (ninguno activo)';
    return rows.map(r => {
        const tail = extra ? ` ${extra(r)}` : '';
        return `  ${r[idKey]} → ${String(r[nameKey] ?? '').trim()}${tail}`;
    }).join('\n');
}

// ─── Builder principal ──────────────────────────────────────────────────────
export async function buildProjectCatalog(
    conn: Connection, cacheKey?: string
): Promise<string> {
    if (cacheKey) {
        const hit = CACHE.get(cacheKey);
        if (hit && hit.expires > Date.now()) return hit.text;
    }

    // 1) Dimensiones de baja cardinalidad (todas) — solo activas (Status <> 2)
    const [sucursales, canales, terminales, turnos, puestos, categorias, secciones] = await Promise.all([
        safeRows(conn, `SELECT IdSucursal, Sucursal FROM tblSucursales WHERE COALESCE(Status,0) <> 2 ORDER BY IdSucursal`),
        safeRows(conn, `SELECT IdCanalVenta, CanalVenta, Comision FROM tblCanalesVenta WHERE COALESCE(Status,0) <> 2 ORDER BY IdSucursal, Orden`),
        safeRows(conn, `SELECT IdTerminal, Terminal, Comision FROM tblTerminales WHERE COALESCE(Status,0) <> 2 ORDER BY IdSucursal, IdTerminal`),
        safeRows(conn, `SELECT IdTurno, Turno FROM tblTurnos WHERE COALESCE(Status,0) <> 2 ORDER BY IdSucursal, IdTurno`),
        safeRows(conn, `SELECT IdPuesto, Puesto FROM tblPuestos WHERE COALESCE(Status,0) <> 2 ORDER BY IdPuesto`),
        safeRows(conn, `SELECT IdCategoria, Categoria FROM tblCategorias WHERE COALESCE(Status,0) <> 2 ORDER BY IdCategoria`),
        safeRows(conn, `SELECT IdSeccionMenu, SeccionMenu FROM tblSeccionesMenu WHERE COALESCE(Status,0) <> 2 ORDER BY IdSeccionMenu`),
    ]);

    // 2) Dimensiones de alta cardinalidad (muestra acotada — el agente puede consultar el resto)
    const CAP = 40;
    const [conceptosGastoAll, proveedoresAll] = await Promise.all([
        safeRows(conn, `SELECT IdConceptoGasto, ConceptoGasto FROM tblConceptosGastos WHERE COALESCE(Status,0) <> 2 ORDER BY IdConceptoGasto`),
        safeRows(conn, `SELECT IdProveedor, Proveedor, EsProveedorGasto FROM tblProveedores WHERE COALESCE(Status,0) <> 2 ORDER BY IdProveedor`),
    ]);
    const conceptosGasto = conceptosGastoAll.slice(0, CAP);
    const proveedores = proveedoresAll.slice(0, CAP);

    // 3) Convención de mes por tabla (detectada en vivo)
    const [mesCanales, mesTerminales, mesGastos, mesNomina, mesInventarios] = await Promise.all([
        detectMonthConvention(conn, 'tblVentasCanalesVenta', 'FechaAct'),
        detectMonthConvention(conn, 'tblVentasTerminales', 'FechaAct'),
        detectMonthConvention(conn, 'tblGastos', 'FechaGasto'),
        detectMonthConvention(conn, 'tblNomina', 'FechaAct'),
        detectMonthConvention(conn, 'tblInventarios', 'FechaInventario'),
    ]);

    // 4) Rango de datos de ventas disponibles
    const rango = (await safeRows(conn,
        `SELECT MIN(Anio) AS minA, MAX(Anio) AS maxA FROM tblVentasTerminales`))[0] || {};

    const convText = (c: string) =>
        c === '0-11' ? '0-11 (Enero=0 … Diciembre=11) → usa Mes = (mes_calendario − 1)'
        : c === '1-12' ? '1-12 (Enero=1) → usa Mes = mes_calendario'
        : 'INCONSISTENTE/sin datos → NO confíes en la columna Mes';

    // tblNomina es históricamente inconsistente entre proyectos. Si no se pudo
    // detectar con confianza, la regla robusta es filtrar por la fecha real.
    const nominaText = mesNomina === 'desconocida'
        ? 'INCONSISTENTE → NO uses la columna Mes; filtra por MONTH(FechaAct)=mm AND YEAR(FechaAct)=aaaa (1-12 natural)'
        : `${convText(mesNomina)} (si una consulta sale rara, valida contra MONTH(FechaAct))`;

    const text = `
CATÁLOGO DEL PROYECTO (datos REALES de la BD activa — úsalos para filtrar y nombrar)
═══════════════════════════════════════════════════════════════════════════

⚠️ CONVENCIÓN DE MES (detectada en vivo en ESTE proyecto — OBLIGATORIO respetarla):
  • tblVentasCanalesVenta.Mes : ${convText(mesCanales)}
  • tblVentasTerminales.Mes   : ${convText(mesTerminales)}
  • tblGastos.Mes             : ${convText(mesGastos)}
  • tblNomina.Mes             : ${nominaText}
  • tblInventarios.Mes        : ${convText(mesInventarios)}
  • tblCompras                : sin columna Mes → filtra por MONTH(FechaCompra) (1-12 natural)
  Ejemplo: para "ventas de mayo 2026" en tblVentasTerminales (${mesTerminales}),
  ${mesTerminales === '0-11' ? 'usa Mes = 4 AND Anio = 2026.' : mesTerminales === '1-12' ? 'usa Mes = 5 AND Anio = 2026.' : 'verifica la convención antes de filtrar.'}

Años con datos de venta: ${rango.minA ?? '?'} – ${rango.maxA ?? '?'}

SUCURSALES (IdSucursal → nombre):
${listDim(sucursales, 'IdSucursal', 'Sucursal')}

CANALES DE VENTA (IdCanalVenta → nombre · comisión):
${listDim(canales, 'IdCanalVenta', 'CanalVenta', r => `· ${Number(r.Comision) || 0}%`)}

TERMINALES / FORMAS DE PAGO (IdTerminal → nombre · comisión):
${listDim(terminales, 'IdTerminal', 'Terminal', r => `· ${Number(r.Comision) || 0}%`)}

TURNOS (IdTurno → nombre):
${listDim(turnos, 'IdTurno', 'Turno')}

PUESTOS (IdPuesto → nombre):
${listDim(puestos, 'IdPuesto', 'Puesto')}

CATEGORÍAS DE PRODUCTO (IdCategoria → nombre):
${listDim(categorias, 'IdCategoria', 'Categoria')}

SECCIONES DE MENÚ (IdSeccionMenu → nombre):
${listDim(secciones, 'IdSeccionMenu', 'SeccionMenu')}

CONCEPTOS DE GASTO (IdConceptoGasto → nombre)${conceptosGastoAll.length > CAP ? ` — mostrando ${CAP} de ${conceptosGastoAll.length}; consulta tblConceptosGastos para el resto` : ''}:
${listDim(conceptosGasto, 'IdConceptoGasto', 'ConceptoGasto')}

PROVEEDORES (IdProveedor → nombre · tipo)${proveedoresAll.length > CAP ? ` — mostrando ${CAP} de ${proveedoresAll.length}; consulta tblProveedores para el resto` : ''}:
${listDim(proveedores, 'IdProveedor', 'Proveedor', r => `· ${Number(r.EsProveedorGasto) === 1 ? 'gasto' : 'insumo'}`)}
`.trim();

    if (cacheKey) CACHE.set(cacheKey, { text, expires: Date.now() + TTL_MS });
    return text;
}
