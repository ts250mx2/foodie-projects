import type { Connection } from 'mysql2/promise';
import { RowDataPacket } from 'mysql2';
import { ProductUnit, normalizeUnit, validateUnits } from '@/lib/units';

/**
 * Persistencia de las presentaciones por producto (tblProductosUnidades).
 *
 * El catálogo tblPresentaciones ya guarda los NOMBRES de unidad (KILOGRAMO,
 * LITRO, BOTE…) pero sin equivalencias: no sabe que un bote trae 3.7 litros.
 * Aquí vive esa equivalencia, por producto, porque el mismo "BOTE" es 3.7 L de
 * aderezo y 19 L de garrafón.
 *
 * Un producto sin renglones aquí no convierte nada y se comporta igual que
 * antes: la adopción es producto por producto.
 */

export const PRODUCT_UNITS_TABLE = 'tblProductosUnidades';

/**
 * Crea la tabla de presentaciones y las columnas del kardex que guardan lo que
 * la persona realmente capturó ("1 BOTE") junto a lo que se guardó en base
 * ("3700 GRAMO"). Idempotente.
 */
export async function ensureProductUnitsTable(connection: Connection) {
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblProductosUnidades\` (
              \`IdProductoUnidad\` int NOT NULL AUTO_INCREMENT,
              \`IdProducto\` int NOT NULL,
              \`Unidad\` varchar(30) NOT NULL,
              \`Factor\` decimal(18,6) NOT NULL DEFAULT 1,
              \`EsBase\` tinyint NOT NULL DEFAULT 0,
              \`EsCompra\` tinyint NOT NULL DEFAULT 0,
              \`EsPedido\` tinyint NOT NULL DEFAULT 0,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdProductoUnidad\`),
              UNIQUE KEY \`uq_producto_unidad\` (\`IdProducto\`, \`Unidad\`),
              KEY \`idx_producto\` (\`IdProducto\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // El kardex conserva la captura original para que el movimiento siga
        // siendo legible ("pidieron 100 gramos") aunque se guarde en base.
        const [movCols]: any = await connection.query('SHOW COLUMNS FROM tblAlmacenMovimientos');
        const movNames = movCols.map((c: any) => c.Field);
        if (!movNames.includes('CantidadCaptura')) {
            await connection.query(
                'ALTER TABLE tblAlmacenMovimientos ADD COLUMN CantidadCaptura decimal(15,4) DEFAULT NULL'
            );
        }
        if (!movNames.includes('UnidadCaptura')) {
            await connection.query(
                'ALTER TABLE tblAlmacenMovimientos ADD COLUMN UnidadCaptura varchar(45) DEFAULT NULL'
            );
        }
    } catch (e) {
        console.error('Error ensuring product units schema:', e);
    }
}

function mapRow(row: RowDataPacket): ProductUnit {
    return {
        unidad: String(row.Unidad || ''),
        factor: Number(row.Factor) || 1,
        esBase: Number(row.EsBase) === 1,
        esCompra: Number(row.EsCompra) === 1,
        esPedido: Number(row.EsPedido) === 1,
    };
}

/** Presentaciones de un producto, base primero. Vacío = sin configurar. */
export async function loadProductUnits(connection: Connection, idProducto: number): Promise<ProductUnit[]> {
    if (!Number.isInteger(idProducto) || idProducto <= 0) return [];
    try {
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT Unidad, Factor, EsBase, EsCompra, EsPedido
               FROM tblProductosUnidades
              WHERE IdProducto = ?
              ORDER BY EsBase DESC, Factor ASC`,
            [idProducto]
        );
        return rows.map(mapRow);
    } catch {
        // La tabla puede no existir todavía en un proyecto que aún no abre
        // conexión por getProjectConnection: sin presentaciones, sin conversión.
        return [];
    }
}

/**
 * Presentaciones de varios productos en una sola consulta. La usan los flujos
 * que aplican un documento completo al almacén, para no consultar por renglón.
 */
export async function loadUnitsForProducts(
    connection: Connection,
    idsProducto: number[]
): Promise<Map<number, ProductUnit[]>> {
    const map = new Map<number, ProductUnit[]>();
    const ids = Array.from(new Set(idsProducto.filter(id => Number.isInteger(id) && id > 0)));
    if (ids.length === 0) return map;

    try {
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT IdProducto, Unidad, Factor, EsBase, EsCompra, EsPedido
               FROM tblProductosUnidades
              WHERE IdProducto IN (${ids.map(() => '?').join(',')})
              ORDER BY EsBase DESC, Factor ASC`,
            ids
        );
        for (const row of rows) {
            const key = Number(row.IdProducto);
            const list = map.get(key) || [];
            list.push(mapRow(row));
            map.set(key, list);
        }
    } catch {
        return map;
    }
    return map;
}

/**
 * Reemplaza las presentaciones de un producto. Valida antes de tocar la BD:
 * un juego inválido (dos bases, factor cero) dejaría el costeo sin sentido.
 * Guardar una lista vacía deja al producto sin conversión.
 */
export async function saveProductUnits(
    connection: Connection,
    idProducto: number,
    units: ProductUnit[]
): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!Number.isInteger(idProducto) || idProducto <= 0) {
        return { ok: false, message: 'Producto inválido.' };
    }

    const clean = units
        .map(u => ({
            unidad: normalizeUnit(u.unidad),
            factor: Number(u.factor),
            esBase: Boolean(u.esBase),
            esCompra: Boolean(u.esCompra),
            esPedido: Boolean(u.esPedido),
        }))
        .filter(u => u.unidad !== '');

    const problema = validateUnits(clean);
    if (problema) return { ok: false, message: problema };

    await connection.query('DELETE FROM tblProductosUnidades WHERE IdProducto = ?', [idProducto]);

    for (const u of clean) {
        await connection.query(
            `INSERT INTO tblProductosUnidades (IdProducto, Unidad, Factor, EsBase, EsCompra, EsPedido, FechaAct)
             VALUES (?, ?, ?, ?, ?, ?, Now())`,
            [idProducto, u.unidad, u.esBase ? 1 : u.factor, u.esBase ? 1 : 0, u.esCompra ? 1 : 0, u.esPedido ? 1 : 0]
        );
    }

    return { ok: true };
}
