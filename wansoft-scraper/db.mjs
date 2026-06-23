// Acceso a MySQL: crea la tabla destino (idempotente) y hace upsert por (Fecha, IdSucursal).
import mysql from 'mysql2/promise';

const TABLE = 'tblWansoftVentasSucursal';

export async function getConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    timezone: '-06:00',
  });
}

export async function ensureTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`${TABLE}\` (
      \`Id\` INT NOT NULL AUTO_INCREMENT,
      \`Fecha\` DATE NOT NULL,
      \`IdSucursal\` INT NOT NULL,
      \`Sucursal\` VARCHAR(150) NULL,
      \`VentasBrutasSubtotal\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`VentasBrutasIva\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`VentasBrutasTotal\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`Cortesias\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`Descuentos\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`Promociones\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`Cancelaciones\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`Anulaciones\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`VentasNetasSubtotal\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`VentasNetasIva\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`VentasNetasTotal\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`CapturadoEn\` DATETIME NOT NULL,
      PRIMARY KEY (\`Id\`),
      UNIQUE KEY \`uq_fecha_sucursal\` (\`Fecha\`, \`IdSucursal\`),
      KEY \`idx_fecha\` (\`Fecha\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

/**
 * Inserta o actualiza la fila del día para una sucursal.
 * Cada corrida horaria refresca el total acumulado del día (upsert).
 */
export async function upsertRow(conn, r) {
  const sql = `
    INSERT INTO \`${TABLE}\`
      (Fecha, IdSucursal, Sucursal,
       VentasBrutasSubtotal, VentasBrutasIva, VentasBrutasTotal,
       Cortesias, Descuentos, Promociones, Cancelaciones, Anulaciones,
       VentasNetasSubtotal, VentasNetasIva, VentasNetasTotal, CapturadoEn)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      Sucursal=VALUES(Sucursal),
      VentasBrutasSubtotal=VALUES(VentasBrutasSubtotal),
      VentasBrutasIva=VALUES(VentasBrutasIva),
      VentasBrutasTotal=VALUES(VentasBrutasTotal),
      Cortesias=VALUES(Cortesias),
      Descuentos=VALUES(Descuentos),
      Promociones=VALUES(Promociones),
      Cancelaciones=VALUES(Cancelaciones),
      Anulaciones=VALUES(Anulaciones),
      VentasNetasSubtotal=VALUES(VentasNetasSubtotal),
      VentasNetasIva=VALUES(VentasNetasIva),
      VentasNetasTotal=VALUES(VentasNetasTotal),
      CapturadoEn=VALUES(CapturadoEn);
  `;
  await conn.execute(sql, [
    r.fecha, r.idSucursal, r.sucursal,
    r.ventasBrutasSubtotal, r.ventasBrutasIva, r.ventasBrutasTotal,
    r.cortesias, r.descuentos, r.promociones, r.cancelaciones, r.anulaciones,
    r.ventasNetasSubtotal, r.ventasNetasIva, r.ventasNetasTotal, r.capturadoEn,
  ]);
}

export { TABLE };
