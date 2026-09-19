import type { Connection } from 'mysql2/promise';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Conteo de inventario por ZONA física (cámara fría, cocina, barra, almacén…).
 *
 * REGLA CENTRAL: la zona NO se le agrega a tblInventarios. Esa tabla conserva
 * una fila por producto/día/sucursal con el TOTAL, porque la leen nueve lugares
 * — estado de resultados, KPIs, detalle del dashboard y el esquema que le
 * describe la base al agente IA. Meterle la zona a la llave multiplicaría las
 * filas y todo lo que hoy suma por producto empezaría a contar de más.
 *
 * En su lugar tblInventariosZonas guarda el desglose y, al guardar, el total de
 * tblInventarios se recalcula como la SUMA de las zonas. Nada de lo que ya
 * funciona se entera, y los inventarios viejos siguen siendo válidos: quedan
 * como total sin desglose.
 *
 * CONVENCIÓN DE MES: aquí Mes va de 1 a 12, igual que tblInventarios (ver la
 * nota de convenciones del proyecto: ventas usa 0-11 y esta área 1-12). El
 * cliente manda 0-11 y las rutas suman 1 antes de llamar a este módulo.
 */

export const MAX_ZONA_LEN = 60;

export interface Zona {
    idZona: number;
    zona: string;
    idSucursal: number;
    orden: number;
}

/** Coordenada de un conteo: qué producto, qué día, qué sucursal. */
export interface ConteoRef {
    idProducto: number;
    dia: number;
    /** 1-12, como tblInventarios. */
    mes: number;
    anio: number;
    idSucursal: number;
}

/**
 * Crea las tablas de zonas. Idempotente.
 *
 * tblZonasProductos es la asignación: qué insumos se cuentan en cada zona. Un
 * producto puede estar en varias (el aceite vive en cocina y en almacén) y el
 * que no esté en ninguna aparece en todas, para que nada se quede sin contar.
 */
export async function ensureInventoryZones(connection: Connection) {
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblZonas\` (
              \`IdZona\` int NOT NULL AUTO_INCREMENT,
              \`IdSucursal\` int NOT NULL,
              \`Zona\` varchar(60) NOT NULL,
              \`Orden\` int NOT NULL DEFAULT 0,
              \`Status\` tinyint NOT NULL DEFAULT 0,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdZona\`),
              KEY \`idx_sucursal\` (\`IdSucursal\`, \`Orden\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblZonasProductos\` (
              \`IdZona\` int NOT NULL,
              \`IdProducto\` int NOT NULL,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdZona\`, \`IdProducto\`),
              KEY \`idx_producto\` (\`IdProducto\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // La llave primaria es la coordenada completa del conteo: así el
        // guardado es un upsert y recontar una zona no duplica renglones.
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblInventariosZonas\` (
              \`IdProducto\` int NOT NULL,
              \`Dia\` int NOT NULL,
              \`Mes\` int NOT NULL,
              \`Anio\` int NOT NULL,
              \`IdSucursal\` int NOT NULL,
              \`IdZona\` int NOT NULL,
              \`Cantidad\` decimal(15,4) NOT NULL DEFAULT 0,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdProducto\`, \`Dia\`, \`Mes\`, \`Anio\`, \`IdSucursal\`, \`IdZona\`),
              KEY \`idx_fecha_sucursal\` (\`Anio\`, \`Mes\`, \`Dia\`, \`IdSucursal\`),
              KEY \`idx_zona\` (\`IdZona\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    } catch (e) {
        console.error('Error ensuring inventory zones schema:', e);
    }
}

/** Zonas activas de una sucursal, en el orden del recorrido del conteo. */
export async function listarZonas(connection: Connection, idSucursal: number): Promise<Zona[]> {
    try {
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT IdZona, IdSucursal, Zona, Orden
               FROM tblZonas
              WHERE IdSucursal = ? AND Status = 0
              ORDER BY Orden ASC, Zona ASC`,
            [idSucursal]
        );
        return rows.map(r => ({
            idZona: Number(r.IdZona),
            zona: String(r.Zona),
            idSucursal: Number(r.IdSucursal),
            orden: Number(r.Orden) || 0,
        }));
    } catch {
        // Proyecto que todavía no abre conexión con el esquema nuevo: sin
        // zonas, la captura se comporta como siempre.
        return [];
    }
}

export function sanitizeZona(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, MAX_ZONA_LEN);
}

/**
 * Recalcula el total de tblInventarios como la suma de las zonas.
 *
 * Debe llamarse después de CADA cambio en tblInventariosZonas. El precio se
 * toma de vlProductos igual que en la captura normal, para que un producto
 * contado por zonas se coste con el mismo criterio que uno contado directo.
 *
 * Si la suma queda en cero y el producto no tenía fila, no se inventa una: un
 * insumo que nadie contó no es lo mismo que uno contado en cero.
 */
export async function recalcularTotal(
    connection: Connection,
    ref: ConteoRef,
    fechaInventario: string
): Promise<number> {
    const [sumRows] = await connection.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(Cantidad), 0) AS Total, COUNT(*) AS Renglones
           FROM tblInventariosZonas
          WHERE IdProducto = ? AND Dia = ? AND Mes = ? AND Anio = ? AND IdSucursal = ?`,
        [ref.idProducto, ref.dia, ref.mes, ref.anio, ref.idSucursal]
    );
    const total = Number(sumRows[0]?.Total) || 0;
    const renglones = Number(sumRows[0]?.Renglones) || 0;

    if (renglones === 0) {
        // Se borraron todas las zonas de ese producto: el total deja de tener
        // respaldo, así que se quita en vez de dejarlo colgado.
        await connection.query(
            `DELETE FROM tblInventarios
              WHERE IdProducto = ? AND Dia = ? AND Mes = ? AND Anio = ? AND IdSucursal = ?`,
            [ref.idProducto, ref.dia, ref.mes, ref.anio, ref.idSucursal]
        );
        return 0;
    }

    await connection.query(
        `INSERT INTO tblInventarios (IdProducto, Dia, Mes, Anio, IdSucursal, FechaInventario, Precio, Cantidad, FechaAct)
         SELECT ?, ?, ?, ?, ?, ?,
                COALESCE((SELECT v.CostoInventario FROM vlProductos v WHERE v.IdProducto = ? LIMIT 1), 0),
                ?, NOW()
         ON DUPLICATE KEY UPDATE
            Cantidad = VALUES(Cantidad),
            Precio = COALESCE((SELECT v.CostoInventario FROM vlProductos v WHERE v.IdProducto = ? LIMIT 1), Precio),
            FechaAct = NOW()`,
        [ref.idProducto, ref.dia, ref.mes, ref.anio, ref.idSucursal, fechaInventario, ref.idProducto, total, ref.idProducto]
    );

    return total;
}

/**
 * Guarda el conteo de UNA zona y devuelve los totales que quedaron.
 *
 * Una cantidad vacía borra el renglón de esa zona en vez de guardar cero: "no
 * conté aquí" y "aquí hay cero" no son lo mismo, y el total tiene que poder
 * distinguirlos.
 */
export async function guardarConteoZona(
    connection: Connection,
    params: {
        idZona: number;
        dia: number;
        mes: number;
        anio: number;
        idSucursal: number;
        fechaInventario: string;
        conteos: { idProducto: number; cantidad: number | null }[];
    }
): Promise<Map<number, number>> {
    const totales = new Map<number, number>();

    for (const conteo of params.conteos) {
        const ref: ConteoRef = {
            idProducto: conteo.idProducto,
            dia: params.dia,
            mes: params.mes,
            anio: params.anio,
            idSucursal: params.idSucursal,
        };

        if (conteo.cantidad === null || !Number.isFinite(conteo.cantidad)) {
            await connection.query(
                `DELETE FROM tblInventariosZonas
                  WHERE IdProducto = ? AND Dia = ? AND Mes = ? AND Anio = ? AND IdSucursal = ? AND IdZona = ?`,
                [ref.idProducto, ref.dia, ref.mes, ref.anio, ref.idSucursal, params.idZona]
            );
        } else {
            await connection.query(
                `INSERT INTO tblInventariosZonas
                    (IdProducto, Dia, Mes, Anio, IdSucursal, IdZona, Cantidad, FechaAct)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE Cantidad = VALUES(Cantidad), FechaAct = NOW()`,
                [ref.idProducto, ref.dia, ref.mes, ref.anio, ref.idSucursal, params.idZona, conteo.cantidad]
            );
        }

        totales.set(conteo.idProducto, await recalcularTotal(connection, ref, params.fechaInventario));
    }

    return totales;
}

/** Reemplaza los productos asignados a una zona. */
export async function asignarProductos(
    connection: Connection,
    idZona: number,
    idsProducto: number[]
): Promise<number> {
    const limpios = Array.from(new Set(
        idsProducto.filter(id => Number.isInteger(id) && id > 0)
    ));

    await connection.query('DELETE FROM tblZonasProductos WHERE IdZona = ?', [idZona]);
    if (limpios.length === 0) return 0;

    await connection.query(
        `INSERT INTO tblZonasProductos (IdZona, IdProducto, FechaAct) VALUES ${limpios.map(() => '(?, ?, NOW())').join(', ')}`,
        limpios.flatMap(id => [idZona, id])
    );
    return limpios.length;
}

/** Ids de los productos asignados a una zona. */
export async function productosDeZona(connection: Connection, idZona: number): Promise<number[]> {
    const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT IdProducto FROM tblZonasProductos WHERE IdZona = ?',
        [idZona]
    );
    return rows.map(r => Number(r.IdProducto));
}

/**
 * Zonas a las que pertenece un producto, de TODAS las sucursales.
 *
 * Es el inverso de productosDeZona: la configuración de zonas se hace zona por
 * zona, pero al dar de alta un insumo es más natural decir dónde vive ese
 * insumo que ir abriendo cada zona a buscarlo.
 */
export async function zonasDeProducto(connection: Connection, idProducto: number): Promise<number[]> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT zp.IdZona
           FROM tblZonasProductos zp
           INNER JOIN tblZonas z ON z.IdZona = zp.IdZona
          WHERE zp.IdProducto = ? AND z.Status = 0`,
        [idProducto]
    );
    return rows.map(r => Number(r.IdZona));
}

/**
 * Reemplaza las zonas de un producto sin tocar las de los demás.
 *
 * Solo borra los renglones de ESTE producto: asignar un insumo a una zona no
 * debe alterar lo que ya tenían configurado las zonas para otros insumos.
 */
export async function asignarZonasAProducto(
    connection: Connection,
    idProducto: number,
    idsZona: number[]
): Promise<number> {
    const limpios = Array.from(new Set(
        idsZona.filter(id => Number.isInteger(id) && id > 0)
    ));

    await connection.query('DELETE FROM tblZonasProductos WHERE IdProducto = ?', [idProducto]);
    if (limpios.length === 0) return 0;

    await connection.query(
        `INSERT INTO tblZonasProductos (IdZona, IdProducto, FechaAct) VALUES ${limpios.map(() => '(?, ?, NOW())').join(', ')}`,
        limpios.flatMap(id => [id, idProducto])
    );
    return limpios.length;
}

/** Todas las zonas activas del proyecto, con el nombre de su sucursal. */
export async function listarZonasDelProyecto(
    connection: Connection
): Promise<{ idZona: number; zona: string; idSucursal: number; sucursal: string }[]> {
    try {
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT z.IdZona, z.Zona, z.IdSucursal, s.Sucursal
               FROM tblZonas z
               LEFT JOIN tblSucursales s ON s.IdSucursal = z.IdSucursal
              WHERE z.Status = 0
              ORDER BY s.Sucursal ASC, z.Orden ASC, z.Zona ASC`
        );
        return rows.map(r => ({
            idZona: Number(r.IdZona),
            zona: String(r.Zona),
            idSucursal: Number(r.IdSucursal),
            sucursal: String(r.Sucursal || `Sucursal ${r.IdSucursal}`),
        }));
    } catch {
        return [];
    }
}

/** Crea una zona al final del recorrido y devuelve su id. */
export async function crearZona(
    connection: Connection,
    idSucursal: number,
    zona: string
): Promise<number> {
    const [ordenRows] = await connection.query<RowDataPacket[]>(
        'SELECT COALESCE(MAX(Orden), 0) + 1 AS Siguiente FROM tblZonas WHERE IdSucursal = ?',
        [idSucursal]
    );
    const orden = Number(ordenRows[0]?.Siguiente) || 1;

    const [result] = await connection.query<ResultSetHeader>(
        'INSERT INTO tblZonas (IdSucursal, Zona, Orden, Status, FechaAct) VALUES (?, ?, ?, 0, NOW())',
        [idSucursal, zona, orden]
    );
    return result.insertId;
}
