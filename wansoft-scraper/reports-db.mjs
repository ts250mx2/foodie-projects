// Capa de BD para los reportes de Wansoft: crea una tabla por reporte (derivada
// de reports-registry.mjs) y refresca los datos del día por (Fecha, IdSucursal)
// con delete+insert (idempotente, soporta que cambien las filas del día).
import { REPORTS } from './reports-registry.mjs';

function sqlType(type) {
  switch (type) {
    case 'money': return 'DECIMAL(14,2) NOT NULL DEFAULT 0';
    case 'int': return 'INT NOT NULL DEFAULT 0';
    case 'num': return 'DECIMAL(10,2) NOT NULL DEFAULT 0';
    default: return 'VARCHAR(255) NULL';
  }
}

/** Crea la tabla destino de un reporte si no existe. */
export async function ensureReportTable(conn, def) {
  const cols = def.columns
    .map((c) => `      \`${c.col}\` ${sqlType(c.type)}`)
    .join(',\n');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`${def.table}\` (
      \`Id\` INT NOT NULL AUTO_INCREMENT,
      \`Fecha\` DATE NOT NULL,
      \`IdSucursal\` INT NOT NULL,
      \`Sucursal\` VARCHAR(150) NULL,
${cols},
      \`CapturadoEn\` DATETIME NOT NULL,
      PRIMARY KEY (\`Id\`),
      KEY \`idx_fecha_sucursal\` (\`Fecha\`, \`IdSucursal\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

/** Crea todas las tablas de reportes (idempotente). */
export async function ensureAllReportTables(conn) {
  for (const def of REPORTS) await ensureReportTable(conn, def);
}

/**
 * Reemplaza las filas del día de un reporte para una sucursal.
 * @param ctx {fecha, idSucursal, sucursal, capturadoEn}
 * @param rows arreglo de objetos {columna: valor} (salida de parseReport)
 */
export async function refreshReport(conn, def, ctx, rows) {
  const { fecha, idSucursal, sucursal, capturadoEn } = ctx;
  await conn.execute(
    `DELETE FROM \`${def.table}\` WHERE Fecha = ? AND IdSucursal = ?`,
    [fecha, idSucursal]
  );
  if (!rows.length) return 0;

  const colNames = def.columns.map((c) => c.col);
  const allCols = ['Fecha', 'IdSucursal', 'Sucursal', ...colNames, 'CapturadoEn'];
  const placeholders = allCols.map(() => '?').join(',');
  const values = rows.map((r) => [
    fecha,
    idSucursal,
    sucursal,
    ...colNames.map((c) => r[c] ?? null),
    capturadoEn,
  ]);

  const sql = `INSERT INTO \`${def.table}\` (${allCols.map((c) => `\`${c}\``).join(',')})
               VALUES (${placeholders})`;
  // Inserta fila por fila para mantener compatibilidad con prepared statements.
  for (const v of values) {
    await conn.execute(sql, v);
  }
  return rows.length;
}
