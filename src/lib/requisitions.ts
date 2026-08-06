import { Connection } from 'mysql2/promise';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '@/lib/db';

/**
 * Requisiciones de cocina.
 *
 * Una requisición es una orden de compra INTERNA levantada desde una tablet en
 * piso, sin login: el acceso es por un UUID de proyecto que va en la URL.
 * Nace como Fantasma (Status 4, FechaAplicacion NULL) — es decir, SIN SURTIR —
 * y el portal la aplica al inventario o la descarta desde Órdenes de Compra.
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
