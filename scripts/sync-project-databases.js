/**
 * scripts/sync-project-databases.js
 *
 * Sincroniza TODAS las bases de datos FG_* del servidor con la BD plantilla
 * (FG_Frijoles, la más completa). SOLO ADITIVO: crea tablas y vistas que
 * falten y agrega columnas nuevas; nunca elimina ni modifica lo existente.
 * Las vistas (vlProductos, vlPlatillos, ...) se reapuntan a las tablas de
 * cada BD destino; las referencias a BDFoodieProjects se conservan.
 *
 * Uso: node scripts/sync-project-databases.js [--dry-run] [--keep-views]
 *   --dry-run     Muestra qué cambiaría sin aplicar nada.
 *   --keep-views  No rehace vistas existentes (solo crea las faltantes).
 */

// Carga .env.local manualmente (no requiere el paquete dotenv)
const fs = require('fs');
const path = require('path');
try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length > 0) process.env[key.trim()] = rest.join('=').trim();
    }
} catch { /* .env.local no existe, se usan los defaults */ }

const mysql = require('mysql2/promise');

const DRY_RUN = process.argv.includes('--dry-run');
const REPLACE_VIEWS = !process.argv.includes('--keep-views');

const TEMPLATE_DB = process.env.TEMPLATE_DB || 'FG_Frijoles';
const CENTRAL_DB = process.env.DB_NAME || 'BDFoodieProjects';

async function listObjects(conn, dbName, type) {
    const [rows] = await conn.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ? ORDER BY TABLE_NAME`,
        [dbName, type]
    );
    return rows.map(r => r.TABLE_NAME);
}

async function getCreateTable(conn, dbName, table) {
    const [rows] = await conn.query(`SHOW CREATE TABLE \`${dbName}\`.\`${table}\``);
    return rows[0]['Create Table'];
}

function retarget(sql, targetDb) {
    return sql.split('`' + TEMPLATE_DB + '`').join('`' + targetDb + '`');
}

async function buildViewSql(conn, view, targetDb) {
    const [rows] = await conn.query(`SHOW CREATE VIEW \`${TEMPLATE_DB}\`.\`${view}\``);
    const match = rows[0]['Create View'].match(/^.*?\sAS\s+(select[\s\S]+)$/i);
    if (!match) throw new Error(`No se pudo extraer el SELECT de la vista ${view}`);
    return `CREATE OR REPLACE VIEW \`${targetDb}\`.\`${view}\` AS ${retarget(match[1], targetDb)}`;
}

function extractColumnDef(createSql, column) {
    for (const line of createSql.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('`' + column + '`')) return trimmed.replace(/,$/, '');
    }
    return null;
}

async function syncDatabase(conn, targetDb) {
    const result = { tables: 0, columns: 0, views: 0, errors: [] };

    // 1. Tablas faltantes
    const templateTables = await listObjects(conn, TEMPLATE_DB, 'BASE TABLE');
    const targetTables = new Set(await listObjects(conn, targetDb, 'BASE TABLE'));
    const missingTables = templateTables.filter(t => !targetTables.has(t));

    for (const table of missingTables) {
        console.log(`  + tabla ${table}`);
        if (!DRY_RUN) {
            try {
                const createSql = (await getCreateTable(conn, TEMPLATE_DB, table))
                    .replace(/^CREATE TABLE\s+`[^`]+`/, `CREATE TABLE IF NOT EXISTS \`${targetDb}\`.\`${table}\``)
                    .replace(/\s+AUTO_INCREMENT=\d+/i, '');
                await conn.query(createSql);
                result.tables++;
            } catch (e) {
                result.errors.push(`tabla ${table}: ${e.message}`);
            }
        }
    }

    // 2. Columnas faltantes en tablas comunes
    const [cols] = await conn.query(
        `SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA IN (?, ?) ORDER BY TABLE_NAME, ORDINAL_POSITION`,
        [TEMPLATE_DB, targetDb]
    );
    const templateCols = new Map();
    const targetCols = new Map();
    for (const row of cols) {
        const map = row.TABLE_SCHEMA === TEMPLATE_DB ? templateCols : targetCols;
        if (!map.has(row.TABLE_NAME)) map.set(row.TABLE_NAME, []);
        map.get(row.TABLE_NAME).push(row.COLUMN_NAME);
    }

    for (const table of templateTables) {
        if (!targetTables.has(table)) continue;
        const existing = new Set(targetCols.get(table) || []);
        const missing = (templateCols.get(table) || []).filter(c => !existing.has(c));
        if (missing.length === 0) continue;

        const createSql = await getCreateTable(conn, TEMPLATE_DB, table);
        for (const column of missing) {
            console.log(`  + columna ${table}.${column}`);
            if (DRY_RUN) continue;
            const def = extractColumnDef(createSql, column);
            if (!def) {
                result.errors.push(`columna ${table}.${column}: definición no encontrada`);
                continue;
            }
            try {
                // Una columna AUTO_INCREMENT debe formar parte de una llave
                const alterSql = /\bAUTO_INCREMENT\b/i.test(def)
                    ? `ALTER TABLE \`${targetDb}\`.\`${table}\` ADD COLUMN ${def}, ADD UNIQUE KEY \`uq_sync_${column}\` (\`${column}\`)`
                    : `ALTER TABLE \`${targetDb}\`.\`${table}\` ADD COLUMN ${def}`;
                await conn.query(alterSql);
                result.columns++;
            } catch (e) {
                result.errors.push(`columna ${table}.${column}: ${e.message}`);
            }
        }
    }

    // 3. Vistas (con reintento por dependencias entre vistas, p.ej. vlPlatillos → vlProductos)
    const templateViews = await listObjects(conn, TEMPLATE_DB, 'VIEW');
    const targetViews = new Set(await listObjects(conn, targetDb, 'VIEW'));
    let pending = REPLACE_VIEWS ? [...templateViews] : templateViews.filter(v => !targetViews.has(v));

    for (const view of pending) {
        console.log(`  ~ vista ${view}${targetViews.has(view) ? ' (rehacer)' : ''}`);
    }
    if (!DRY_RUN) {
        while (pending.length > 0) {
            const failed = [];
            for (const view of pending) {
                try {
                    await conn.query(await buildViewSql(conn, view, targetDb));
                    result.views++;
                } catch (e) {
                    failed.push({ view, message: e.message });
                }
            }
            if (failed.length === pending.length) {
                for (const f of failed) result.errors.push(`vista ${f.view}: ${f.message}`);
                break;
            }
            pending = failed.map(f => f.view);
        }
    }

    return result;
}

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || '74.208.192.90',
        user: process.env.DB_USER || 'kyk',
        password: process.env.DB_PASSWORD || 'merkurio',
        port: Number(process.env.DB_PORT) || 3306,
    });

    console.log(`Plantilla: ${TEMPLATE_DB}${DRY_RUN ? '  [DRY-RUN: no se aplicará nada]' : ''}\n`);

    const [dbs] = await conn.query(
        `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA
         WHERE SCHEMA_NAME LIKE 'FG\\_%' AND SCHEMA_NAME <> ? AND SCHEMA_NAME <> ?
         ORDER BY SCHEMA_NAME`,
        [TEMPLATE_DB, CENTRAL_DB]
    );

    let totalErrors = 0;
    for (const row of dbs) {
        const db = row.SCHEMA_NAME;
        console.log(`\n=== ${db} ===`);
        const result = await syncDatabase(conn, db);
        if (!DRY_RUN) {
            console.log(`  Aplicado: ${result.tables} tablas, ${result.columns} columnas, ${result.views} vistas`);
        }
        for (const err of result.errors) {
            console.error(`  ERROR: ${err}`);
            totalErrors++;
        }
    }

    await conn.end();
    console.log(`\nListo. ${dbs.length} bases procesadas, ${totalErrors} errores.`);
    if (totalErrors > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
