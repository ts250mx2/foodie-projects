import { Connection } from 'mysql2/promise';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '@/lib/db';

/**
 * Requisiciones de cocina.
 *
 * Una requisición es una orden de compra INTERNA levantada desde una tablet en
 * piso, sin login: el acceso es por un UUID de proyecto que va en la URL.
 * Nace como Creada (Status 4, FechaAplicacion NULL) — es decir, SIN SURTIR — y
 * el portal la mueve por su ciclo de vida desde Requisiciones
 * (ver src/lib/requisition-status.ts): Aceptada, Salida de almacén (que es la
 * que descarga existencias), Rechazada o Cancelada.
 *
 * El UUID vive en su propia columna (UUIDRequisicion) y NO reutiliza el
 * UUID general del proyecto: ese se asigna en el alta y hoy trae valores
 * adivinables en proyectos viejos ('pozole', '123123123'), lo que sería un
 * agujero en una página sin autenticación. Tener columna aparte además
 * permite revocar la liga de la tablet sin tocar nada más.
 */

export const REQUISITION_PROVIDER_NAME = 'REQUISICIÓN DE COCINA';

/** Topes defensivos: la creación es un endpoint público. */
export const MAX_REQUISITION_ITEMS = 120;
export const MAX_REQUISITION_QTY = 100000;
export const MAX_SOLICITANTE_LEN = 120;
export const MAX_AREA_LEN = 60;
export const MAX_NOTAS_LEN = 500;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RequisitionProject {
    idProyecto: number;
    proyecto: string;
    titulo: string | null;
    logo64: string | null;
    colorFondo1: string;
    colorFondo2: string;
    colorLetra: string;
}

/** Un UUID mal formado nunca llega a la base: se descarta antes de consultar. */
export function isValidRequisitionUuid(uuid: unknown): uuid is string {
    return typeof uuid === 'string' && UUID_PATTERN.test(uuid);
}

/** Columna del UUID de requisición en la BD central. Idempotente. */
async function ensureRequisitionUuidColumn(): Promise<void> {
    const [cols] = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM tblProyectos');
    const names = cols.map(c => c.Field);
    if (!names.includes('UUIDRequisicion')) {
        await pool.query('ALTER TABLE tblProyectos ADD COLUMN UUIDRequisicion VARCHAR(36) NULL');
    }
}

/**
 * Devuelve el UUID de requisición del proyecto y lo genera si aún no existe.
 * Solo debe llamarse desde el portal autenticado (es quien reparte la liga).
 */
export async function getOrCreateRequisitionUuid(projectId: number): Promise<string | null> {
    await ensureRequisitionUuidColumn();

    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT UUID, UUIDRequisicion FROM tblProyectos WHERE IdProyecto = ?',
        [projectId]
    );
    if (rows.length === 0) return null;

    const existing = rows[0].UUIDRequisicion;
    if (isValidRequisitionUuid(existing)) return existing;

    // Estrena adoptando el UUID general del proyecto: es el que la gente ya
    // tiene a la mano. Los proyectos viejos cuyo UUID es adivinable
    // ('pozole', '123123123') no pasan el filtro de formato y reciben uno
    // nuevo generado, que es justamente lo que los protege.
    const general = rows[0].UUID;
    const uuid = isValidRequisitionUuid(general) ? general : crypto.randomUUID();

    await pool.query('UPDATE tblProyectos SET UUIDRequisicion = ? WHERE IdProyecto = ?', [uuid, projectId]);
    return uuid;
}

/** Rota el UUID: invalida la liga repartida y emite una nueva. */
export async function rotateRequisitionUuid(projectId: number): Promise<string> {
    await ensureRequisitionUuidColumn();
    const uuid = crypto.randomUUID();
    await pool.query('UPDATE tblProyectos SET UUIDRequisicion = ? WHERE IdProyecto = ?', [uuid, projectId]);
    return uuid;
}

/**
 * Traduce el UUID de la URL al proyecto. Es la ÚNICA forma en que la página
 * pública identifica un proyecto: el cliente nunca manda projectId.
 */
export async function resolveRequisitionUuid(uuid: string): Promise<RequisitionProject | null> {
    if (!isValidRequisitionUuid(uuid)) return null;

    await ensureRequisitionUuidColumn();

    // Sirven las dos ligas: la dedicada de requisiciones y el UUID general del
    // proyecto. Aceptar el general es seguro porque el filtro de formato de
    // arriba ya descartó los valores adivinables de los proyectos viejos, así
    // que un 'pozole' nunca llega hasta aquí. Se prefiere la dedicada para que
    // rotarla mande sobre la general.
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT IdProyecto, Proyecto, Titulo, Logo64, ColorFondo1, ColorFondo2, ColorLetra
         FROM tblProyectos
         WHERE UUIDRequisicion = ? OR (UUID = ? AND (UUIDRequisicion IS NULL OR UUIDRequisicion = ''))
         ORDER BY (UUIDRequisicion = ?) DESC
         LIMIT 1`,
        [uuid, uuid, uuid]
    );
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
        idProyecto: row.IdProyecto,
        proyecto: row.Proyecto,
        titulo: row.Titulo || null,
        logo64: row.Logo64 || null,
        colorFondo1: row.ColorFondo1 || '#1f6f4a',
        colorFondo2: row.ColorFondo2 || '#14532d',
        colorLetra: row.ColorLetra || '#ffffff',
    };
}

/**
 * Marca de requisición sobre tblOrdenesCompra, en la BD de cada proyecto.
 * Idempotente: se llama al abrir conexión de proyecto (ver dynamic-db.ts).
 */
export async function ensureRequisitionColumns(connection: Connection): Promise<void> {
    try {
        const [cols] = await connection.query<RowDataPacket[]>('SHOW COLUMNS FROM tblOrdenesCompra');
        const names = cols.map(c => c.Field);

        if (!names.includes('EsRequisicion')) {
            await connection.query('ALTER TABLE tblOrdenesCompra ADD COLUMN EsRequisicion TINYINT NOT NULL DEFAULT 0');
        }
        if (!names.includes('RequisicionSolicitante')) {
            await connection.query('ALTER TABLE tblOrdenesCompra ADD COLUMN RequisicionSolicitante VARCHAR(120) NULL');
        }
        if (!names.includes('RequisicionArea')) {
            await connection.query('ALTER TABLE tblOrdenesCompra ADD COLUMN RequisicionArea VARCHAR(60) NULL');
        }
        // NULL = nadie la ha visto en el portal todavía: es lo que enciende la campana.
        if (!names.includes('FechaRequisicionVista')) {
            await connection.query('ALTER TABLE tblOrdenesCompra ADD COLUMN FechaRequisicionVista DATETIME NULL');
        }

        const [idx] = await connection.query<RowDataPacket[]>(
            "SHOW INDEX FROM tblOrdenesCompra WHERE Key_name = 'idx_requisicion_pendiente'"
        );
        if (idx.length === 0) {
            await connection.query(
                'CREATE INDEX idx_requisicion_pendiente ON tblOrdenesCompra (EsRequisicion, FechaRequisicionVista)'
            );
        }
    } catch (e) {
        console.error('Error ensuring requisition schema:', e);
    }
}

/** Perfiles con los que arranca el módulo la primera vez. */
export const DEFAULT_PROFILES = ['Cocina', 'Barra', 'Caja', 'Almacén', 'Limpieza'] as const;

export const MAX_PROFILE_NAME_LEN = 60;
/** El PIN es de dígitos: la tablet lo captura con teclado numérico. */
export const PIN_PATTERN = /^\d{4,8}$/;

/**
 * Perfiles de requisición (Cocina, Barra, …) con PIN opcional, POR SUCURSAL:
 * la cocina de una sucursal y la de otra son equipos distintos, con su propia
 * gente y su propio PIN.
 *
 * El PIN no es una contraseña: la liga de la tablet ya es pública por diseño.
 * Sirve para que un pedido quede firmado por quien realmente lo levanta y para
 * que no cualquiera capture a nombre de otra área. Aun así se guarda hasheado,
 * porque es un secreto compartido que la gente reutiliza en otros lados.
 *
 * Siembra los perfiles base en toda sucursal activa que no tenga ninguno. Eso
 * cubre también las sucursales que se den de alta después. La contrapartida
 * asumida: si alguien borra TODOS los perfiles de una sucursal, vuelven a
 * aparecer — una sucursal sin perfiles no puede levantar requisiciones, así que
 * ese estado no le sirve a nadie.
 */
export async function ensureRequisitionProfiles(connection: Connection): Promise<void> {
    try {
        const [tables] = await connection.query("SHOW TABLES LIKE 'tblRequisicionPerfiles'");

        if ((tables as RowDataPacket[]).length === 0) {
            await connection.query(`
                CREATE TABLE \`tblRequisicionPerfiles\` (
                  \`IdPerfil\` int NOT NULL AUTO_INCREMENT,
                  \`IdSucursal\` int NOT NULL,
                  \`Perfil\` varchar(60) NOT NULL,
                  \`PinHash\` varchar(255) NULL,
                  \`Orden\` int NOT NULL DEFAULT 0,
                  \`FechaAct\` datetime DEFAULT NULL,
                  PRIMARY KEY (\`IdPerfil\`),
                  UNIQUE KEY \`uq_perfil_sucursal\` (\`IdSucursal\`, \`Perfil\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
        } else {
            // Migración de la versión sin sucursal: los perfiles existentes se
            // quedan con la primera sucursal activa y la unicidad pasa a ser
            // por (sucursal, nombre).
            const [cols] = await connection.query<RowDataPacket[]>('SHOW COLUMNS FROM tblRequisicionPerfiles');
            if (!cols.some(c => c.Field === 'IdSucursal')) {
                await connection.query('ALTER TABLE tblRequisicionPerfiles ADD COLUMN IdSucursal INT NOT NULL DEFAULT 0 AFTER IdPerfil');
                await connection.query('ALTER TABLE tblRequisicionPerfiles DROP INDEX uq_perfil').catch(() => {});
                await connection.query(
                    `UPDATE tblRequisicionPerfiles SET IdSucursal =
                        COALESCE((SELECT MIN(IdSucursal) FROM tblSucursales WHERE Status = 0), 0)
                     WHERE IdSucursal = 0`
                );
                await connection.query(
                    'ALTER TABLE tblRequisicionPerfiles ADD UNIQUE KEY `uq_perfil_sucursal` (`IdSucursal`, `Perfil`)'
                ).catch(() => {});
            }
        }

        // Sucursales activas sin ningún perfil: se les siembran los base.
        const [branches] = await connection.query<RowDataPacket[]>(
            `SELECT s.IdSucursal FROM tblSucursales s
             WHERE s.Status = 0
               AND NOT EXISTS (SELECT 1 FROM tblRequisicionPerfiles p WHERE p.IdSucursal = s.IdSucursal)`
        );

        for (const branch of branches) {
            for (const [index, nombre] of DEFAULT_PROFILES.entries()) {
                await connection.query(
                    'INSERT IGNORE INTO tblRequisicionPerfiles (IdSucursal, Perfil, PinHash, Orden, FechaAct) VALUES (?, ?, NULL, ?, Now())',
                    [branch.IdSucursal, nombre, index]
                );
            }
        }
    } catch (e) {
        console.error('Error ensuring requisition profiles:', e);
    }
}

/**
 * Categorías visibles por perfil de captura.
 *
 * Un perfil SIN renglones aquí ve el catálogo completo — es el caso normal y
 * por eso no se siembra nada al crear el perfil. Cuando sí tiene categorías,
 * la tablet muestra las suyas al frente y el resto detrás, separadas: nunca se
 * esconden, porque cocina a veces necesita algo de otra área y la tablet no
 * tiene a quién pedirle permiso.
 *
 * IdCategoria 0 representa "Sin categoría" (insumos con IdCategoria NULL).
 * Idempotente.
 */
export async function ensureRequisitionProfileCategories(connection: Connection): Promise<void> {
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblRequisicionPerfilesCategorias\` (
              \`IdPerfilCategoria\` int NOT NULL AUTO_INCREMENT,
              \`IdPerfil\` int NOT NULL,
              \`IdCategoria\` int NOT NULL,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdPerfilCategoria\`),
              UNIQUE KEY \`uq_perfil_categoria\` (\`IdPerfil\`, \`IdCategoria\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    } catch (e) {
        console.error('Error ensuring requisition profile categories schema:', e);
    }
}

/** Tope defensivo por si llega una lista absurda desde el portal. */
export const MAX_PROFILE_CATEGORIES = 300;

/** Normaliza la lista de categorías que manda el portal: enteros ≥ 0, sin repetir. */
export function sanitizeCategoryIds(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    const unique = new Set<number>();
    for (const raw of value) {
        const id = Number(raw);
        if (Number.isInteger(id) && id >= 0) unique.add(id);
        if (unique.size >= MAX_PROFILE_CATEGORIES) break;
    }
    return [...unique];
}

/** Reemplaza el juego de categorías del perfil. Lista vacía = ve todo. */
export async function replaceProfileCategories(
    connection: Connection,
    idPerfil: number,
    categorias: number[]
): Promise<void> {
    await connection.query('DELETE FROM tblRequisicionPerfilesCategorias WHERE IdPerfil = ?', [idPerfil]);
    if (categorias.length === 0) return;

    await connection.query(
        `INSERT INTO tblRequisicionPerfilesCategorias (IdPerfil, IdCategoria, FechaAct)
         VALUES ${categorias.map(() => '(?, ?, Now())').join(', ')}`,
        categorias.flatMap(id => [idPerfil, id])
    );
}

/**
 * Categorías de los insumos activos del proyecto — lo mismo que verá la
 * tablet. Se arma del catálogo real y no de tblCategorias completa para no
 * ofrecer categorías que aquí no tienen ni un insumo.
 */
export async function listRequisitionCategories(
    connection: Connection
): Promise<Array<{ IdCategoria: number; Categoria: string }>> {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT DISTINCT
            COALESCE(p.IdCategoria, 0) AS IdCategoria,
            COALESCE(c.Categoria, 'Sin categoría') AS Categoria
         FROM tblProductos p
         LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
         WHERE p.Status = 0 AND p.IdTipoProducto = 0
         ORDER BY Categoria ASC`
    );
    return rows.map(row => ({ IdCategoria: Number(row.IdCategoria), Categoria: String(row.Categoria) }));
}

/** Convierte el GROUP_CONCAT de categorías en arreglo de números. */
export function parseCategoryCsv(value: unknown): number[] {
    if (typeof value !== 'string' || !value) return [];
    return value.split(',').map(Number).filter(Number.isInteger);
}

/**
 * Bitácora de estados de la requisición: quién la movió, cuándo y por qué.
 *
 * Es la fuente del "track" que dibuja el modal de estado (línea de tiempo con
 * los tiempos que pasó en cada etapa), así que guarda un renglón por CADA
 * cambio, incluido el alta. Idempotente.
 */
export async function ensureRequisitionStatusHistory(connection: Connection): Promise<void> {
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblOrdenesCompraEstatus\` (
              \`IdEstatus\` int NOT NULL AUTO_INCREMENT,
              \`IdOrdenCompra\` int NOT NULL,
              \`StatusAnterior\` int DEFAULT NULL,
              \`StatusNuevo\` int NOT NULL,
              \`Notas\` varchar(500) DEFAULT NULL,
              \`Usuario\` varchar(120) DEFAULT NULL,
              \`FechaCambio\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdEstatus\`),
              KEY \`idx_orden_fecha\` (\`IdOrdenCompra\`, \`FechaCambio\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    } catch (e) {
        console.error('Error ensuring requisition status history schema:', e);
    }
}

export interface RequisitionStatusChange {
    idOrdenCompra: number;
    statusAnterior?: number | null;
    statusNuevo: number;
    notas?: string | null;
    usuario?: string | null;
}

/**
 * Registra un cambio de estado. Debe llamarse dentro de la misma transacción
 * que mueve la orden: si el cambio se revierte, la bitácora también.
 */
export async function recordRequisitionStatusChange(
    connection: Connection,
    change: RequisitionStatusChange
): Promise<void> {
    await connection.query(
        `INSERT INTO tblOrdenesCompraEstatus
            (IdOrdenCompra, StatusAnterior, StatusNuevo, Notas, Usuario, FechaCambio)
         VALUES (?, ?, ?, ?, ?, Now())`,
        [
            change.idOrdenCompra,
            change.statusAnterior ?? null,
            change.statusNuevo,
            change.notas ?? null,
            change.usuario ?? null,
        ]
    );
}

/** Busca o crea el proveedor sintético al que se cuelgan las requisiciones. */
export async function resolveRequisitionProvider(connection: Connection): Promise<number> {
    const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT IdProveedor FROM tblProveedores WHERE Proveedor = ?',
        [REQUISITION_PROVIDER_NAME]
    );
    if (rows.length > 0) return rows[0].IdProveedor;

    const [inserted] = await connection.query<ResultSetHeader>(
        'INSERT INTO tblProveedores (Proveedor, Status, FechaAct) VALUES (?, 0, Now())',
        [REQUISITION_PROVIDER_NAME]
    );
    return inserted.insertId;
}

/** Recorta y normaliza texto libre que llega de la tablet. */
export function sanitizeText(value: unknown, maxLen: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (!trimmed) return null;
    return trimmed.slice(0, maxLen);
}
