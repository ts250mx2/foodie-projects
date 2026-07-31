import mysql, { Connection } from 'mysql2/promise';

/**
 * Base de datos plantilla de Foodie Solutions. Es la BD de referencia (la más
 * completa): al registrar un proyecto se clona su estructura, y la
 * sincronización replica hacia las demás BDs FG_* lo que se agregue aquí.
 */
export const TEMPLATE_DB = process.env.TEMPLATE_DB || 'FG_Frijoles';

/** BD central compartida; las vistas la referencian y NUNCA debe retargetearse. */
const CENTRAL_DB = process.env.DB_NAME || 'BDFoodieProjects';

export interface DatabaseDiff {
    database: string;
    missingTables: string[];
    /** tabla → columnas que existen en la plantilla pero faltan en la BD destino */
    missingColumns: Record<string, string[]>;
    missingViews: string[];
}

export interface SyncReport extends DatabaseDiff {
    tablesCreated: string[];
    /** formato "tabla.columna" */
    columnsAdded: string[];
    viewsCreated: string[];
    errors: string[];
}

/** Conexión a nivel servidor (sin BD seleccionada), donde viven las BDs FG_*. */
export function createServerConnection(): Promise<Connection> {
    return mysql.createConnection({
        host: process.env.DB_HOST || '74.208.192.90',
        user: process.env.DB_USER || 'kyk',
        password: process.env.DB_PASSWORD || 'merkurio',
        port: Number(process.env.DB_PORT) || 3306,
    });
}

async function databaseExists(connection: Connection, dbName: string): Promise<boolean> {
    const [rows] = await connection.query<any[]>(
        'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
        [dbName]
    );
    return rows.length > 0;
}

async function listBaseTables(connection: Connection, dbName: string): Promise<string[]> {
    const [rows] = await connection.query<any[]>(
        `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
        [dbName]
    );
    return rows.map(r => r.TABLE_NAME);
}

async function listViews(connection: Connection, dbName: string): Promise<string[]> {
    const [rows] = await connection.query<any[]>(
        `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'VIEW' ORDER BY TABLE_NAME`,
        [dbName]
    );
    return rows.map(r => r.TABLE_NAME);
}

async function getCreateTableSql(connection: Connection, dbName: string, table: string): Promise<string> {
    const [rows] = await connection.query<any[]>(`SHOW CREATE TABLE \`${dbName}\`.\`${table}\``);
    return rows[0]['Create Table'] as string;
}

/**
 * Convierte el SHOW CREATE TABLE de la plantilla en un CREATE TABLE IF NOT EXISTS
 * calificado hacia la BD destino, sin el contador AUTO_INCREMENT de la plantilla.
 */
function buildCreateTableForTarget(createSql: string, targetDb: string, table: string): string {
    return createSql
        .replace(/^CREATE TABLE\s+`[^`]+`/, `CREATE TABLE IF NOT EXISTS \`${targetDb}\`.\`${table}\``)
        .replace(/\s+AUTO_INCREMENT=\d+/i, '');
}

/**
 * Reapunta toda referencia `Plantilla`.`objeto` hacia la BD destino.
 * Las referencias a la BD central (BDFoodieProjects) se conservan intactas.
 */
function retargetSql(sql: string, targetDb: string): string {
    return sql.split('`' + TEMPLATE_DB + '`').join('`' + targetDb + '`');
}

/**
 * Obtiene la definición de una vista de la plantilla como
 * "CREATE OR REPLACE VIEW `destino`.`vista` AS select ..." reapuntada al destino.
 */
async function buildViewSqlForTarget(connection: Connection, view: string, targetDb: string): Promise<string> {
    const [rows] = await connection.query<any[]>(`SHOW CREATE VIEW \`${TEMPLATE_DB}\`.\`${view}\``);
    const createView = rows[0]['Create View'] as string;

    const match = createView.match(/^.*?\sAS\s+(select[\s\S]+)$/i);
    if (!match) {
        throw new Error(`No se pudo extraer el SELECT de la vista ${view}`);
    }

    const selectBody = retargetSql(match[1], targetDb);
    return `CREATE OR REPLACE VIEW \`${targetDb}\`.\`${view}\` AS ${selectBody}`;
}

/**
 * Crea vistas resolviendo dependencias entre ellas (p.ej. vlPlatillos depende de
 * vlProductos): reintenta en pasadas hasta que ya no haya avance.
 */
async function createViewsWithDependencies(
    connection: Connection,
    targetDb: string,
    views: string[],
    report?: { viewsCreated: string[]; errors: string[] }
): Promise<void> {
    let pending = [...views];

    while (pending.length > 0) {
        const failed: { view: string; error: string }[] = [];

        for (const view of pending) {
            try {
                const sql = await buildViewSqlForTarget(connection, view, targetDb);
                await connection.query(sql);
                report?.viewsCreated.push(view);
            } catch (error: unknown) {
                failed.push({ view, error: error instanceof Error ? error.message : String(error) });
            }
        }

        if (failed.length === pending.length) {
            // Ninguna vista avanzó en esta pasada: registrar y salir
            for (const f of failed) {
                report?.errors.push(`Vista ${f.view}: ${f.error}`);
            }
            return;
        }
        pending = failed.map(f => f.view);
    }
}

/**
 * Clona la ESTRUCTURA completa de la plantilla (FG_Frijoles) en una BD nueva:
 * todas las tablas (sin datos) y todas las vistas (vlProductos, vlPlatillos, ...)
 * reapuntadas a las tablas de la BD nueva. Siembra la sucursal inicial.
 *
 * Lanza error si la plantilla no existe (el caller decide el fallback).
 */
export async function cloneDatabaseFromTemplate(targetDb: string): Promise<void> {
    const connection = await createServerConnection();

    try {
        if (!(await databaseExists(connection, TEMPLATE_DB))) {
            throw new Error(`La BD plantilla ${TEMPLATE_DB} no existe en el servidor`);
        }

        // Crear la BD con el mismo charset/collation que la plantilla
        try {
            const [rows] = await connection.query<any[]>(`SHOW CREATE DATABASE \`${TEMPLATE_DB}\``);
            const createDbSql = (rows[0]['Create Database'] as string)
                .replace(/^CREATE DATABASE/, 'CREATE DATABASE IF NOT EXISTS')
                .replace('`' + TEMPLATE_DB + '`', '`' + targetDb + '`');
            await connection.query(createDbSql);
        } catch {
            await connection.query(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\``);
        }

        // Clonar estructura de todas las tablas
        const tables = await listBaseTables(connection, TEMPLATE_DB);
        for (const table of tables) {
            const createSql = await getCreateTableSql(connection, TEMPLATE_DB, table);
            await connection.query(buildCreateTableForTarget(createSql, targetDb, table));
        }

        // Crear todas las vistas de la plantilla apuntando a la BD nueva
        const views = await listViews(connection, TEMPLATE_DB);
        const viewReport = { viewsCreated: [] as string[], errors: [] as string[] };
        await createViewsWithDependencies(connection, targetDb, views, viewReport);
        if (viewReport.errors.length > 0) {
            throw new Error(`Errores creando vistas en ${targetDb}: ${viewReport.errors.join('; ')}`);
        }

        // Sembrar sucursal inicial (igual que el init legado)
        const [sucursales] = await connection.query<any[]>(
            `SELECT COUNT(*) AS total FROM \`${targetDb}\`.tblSucursales`
        );
        if (Number(sucursales[0]?.total) === 0) {
            await connection.query(
                `INSERT INTO \`${targetDb}\`.tblSucursales (Sucursal, Status, FechaAct) VALUES ('Branch', 0, NOW())`
            );
        }
    } finally {
        await connection.end();
    }
}

/**
 * Calcula qué le falta a una BD respecto a la plantilla (solo aditivo):
 * tablas nuevas, columnas nuevas en tablas existentes y vistas faltantes.
 */
export async function diffDatabaseWithTemplate(connection: Connection, targetDb: string): Promise<DatabaseDiff> {
    const diff: DatabaseDiff = {
        database: targetDb,
        missingTables: [],
        missingColumns: {},
        missingViews: [],
    };

    const [templateTables, targetTables] = await Promise.all([
        listBaseTables(connection, TEMPLATE_DB),
        listBaseTables(connection, targetDb),
    ]);
    const targetTableSet = new Set(targetTables);
    diff.missingTables = templateTables.filter(t => !targetTableSet.has(t));

    // Columnas faltantes en tablas que existen en ambas BDs
    const commonTables = templateTables.filter(t => targetTableSet.has(t));
    if (commonTables.length > 0) {
        const [columns] = await connection.query<any[]>(
            `SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA IN (?, ?)
             ORDER BY TABLE_NAME, ORDINAL_POSITION`,
            [TEMPLATE_DB, targetDb]
        );

        const templateCols = new Map<string, string[]>();
        const targetCols = new Map<string, Set<string>>();
        for (const row of columns) {
            if (row.TABLE_SCHEMA === TEMPLATE_DB) {
                const list = templateCols.get(row.TABLE_NAME) || [];
                list.push(row.COLUMN_NAME);
                templateCols.set(row.TABLE_NAME, list);
            } else {
                const set = targetCols.get(row.TABLE_NAME) || new Set<string>();
                set.add(row.COLUMN_NAME);
                targetCols.set(row.TABLE_NAME, set);
            }
        }

        for (const table of commonTables) {
            const existing = targetCols.get(table) || new Set<string>();
            const missing = (templateCols.get(table) || []).filter(c => !existing.has(c));
            if (missing.length > 0) {
                diff.missingColumns[table] = missing;
            }
        }
    }

    const [templateViews, targetViews] = await Promise.all([
        listViews(connection, TEMPLATE_DB),
        listViews(connection, targetDb),
    ]);
    const targetViewSet = new Set(targetViews);
    diff.missingViews = templateViews.filter(v => !targetViewSet.has(v));

    return diff;
}

/** Extrae la definición de una columna del SHOW CREATE TABLE de la plantilla. */
function extractColumnDefinition(createSql: string, column: string): string | null {
    for (const line of createSql.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('`' + column + '`')) {
            return trimmed.replace(/,$/, '');
        }
    }
    return null;
}

export interface SyncOptions {
    /** true = CREATE OR REPLACE de TODAS las vistas de la plantilla (propaga cambios de definición) */
    replaceViews?: boolean;
}

/**
 * Sincroniza una BD con la plantilla. SOLO ADITIVO: crea tablas y vistas que
 * falten y agrega columnas nuevas. Nunca elimina ni modifica lo existente.
 */
export async function syncDatabaseWithTemplate(
    connection: Connection,
    targetDb: string,
    options: SyncOptions = {}
): Promise<SyncReport> {
    const diff = await diffDatabaseWithTemplate(connection, targetDb);
    const report: SyncReport = {
        ...diff,
        tablesCreated: [],
        columnsAdded: [],
        viewsCreated: [],
        errors: [],
    };

    for (const table of diff.missingTables) {
        try {
            const createSql = await getCreateTableSql(connection, TEMPLATE_DB, table);
            await connection.query(buildCreateTableForTarget(createSql, targetDb, table));
            report.tablesCreated.push(table);
        } catch (error: unknown) {
            report.errors.push(`Tabla ${table}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    for (const [table, columns] of Object.entries(diff.missingColumns)) {
        try {
            const createSql = await getCreateTableSql(connection, TEMPLATE_DB, table);
            for (const column of columns) {
                const definition = extractColumnDefinition(createSql, column);
                if (!definition) {
                    report.errors.push(`Columna ${table}.${column}: definición no encontrada en la plantilla`);
                    continue;
                }
                try {
                    // Una columna AUTO_INCREMENT debe formar parte de una llave
                    const alterSql = /\bAUTO_INCREMENT\b/i.test(definition)
                        ? `ALTER TABLE \`${targetDb}\`.\`${table}\` ADD COLUMN ${definition}, ADD UNIQUE KEY \`uq_sync_${column}\` (\`${column}\`)`
                        : `ALTER TABLE \`${targetDb}\`.\`${table}\` ADD COLUMN ${definition}`;
                    await connection.query(alterSql);
                    report.columnsAdded.push(`${table}.${column}`);
                } catch (error: unknown) {
                    report.errors.push(`Columna ${table}.${column}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        } catch (error: unknown) {
            report.errors.push(`Tabla ${table} (columnas): ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    const viewsToCreate = options.replaceViews
        ? await listViews(connection, TEMPLATE_DB)
        : diff.missingViews;
    await createViewsWithDependencies(connection, targetDb, viewsToCreate, report);

    return report;
}

/**
 * Sincroniza TODAS las BDs FG_* del servidor (excepto la plantilla) con la
 * plantilla. Devuelve un reporte por BD.
 */
export async function syncAllProjectDatabases(options: SyncOptions = {}): Promise<SyncReport[]> {
    const connection = await createServerConnection();

    try {
        if (!(await databaseExists(connection, TEMPLATE_DB))) {
            throw new Error(`La BD plantilla ${TEMPLATE_DB} no existe en el servidor`);
        }

        const [rows] = await connection.query<any[]>(
            `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA
             WHERE SCHEMA_NAME LIKE 'FG\\_%' AND SCHEMA_NAME <> ? AND SCHEMA_NAME <> ?
             ORDER BY SCHEMA_NAME`,
            [TEMPLATE_DB, CENTRAL_DB]
        );

        const reports: SyncReport[] = [];
        for (const row of rows) {
            reports.push(await syncDatabaseWithTemplate(connection, row.SCHEMA_NAME, options));
        }
        return reports;
    } finally {
        await connection.end();
    }
}

/** Diff (dry-run) de TODAS las BDs FG_* del servidor contra la plantilla. */
export async function diffAllProjectDatabases(): Promise<DatabaseDiff[]> {
    const connection = await createServerConnection();

    try {
        if (!(await databaseExists(connection, TEMPLATE_DB))) {
            throw new Error(`La BD plantilla ${TEMPLATE_DB} no existe en el servidor`);
        }

        const [rows] = await connection.query<any[]>(
            `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA
             WHERE SCHEMA_NAME LIKE 'FG\\_%' AND SCHEMA_NAME <> ? AND SCHEMA_NAME <> ?
             ORDER BY SCHEMA_NAME`,
            [TEMPLATE_DB, CENTRAL_DB]
        );

        const diffs: DatabaseDiff[] = [];
        for (const row of rows) {
            diffs.push(await diffDatabaseWithTemplate(connection, row.SCHEMA_NAME));
        }
        return diffs;
    } finally {
        await connection.end();
    }
}
