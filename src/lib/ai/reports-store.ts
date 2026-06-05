/**
 * Persistencia del Agente Avanzado de Reportes (MVP).
 *
 * Una fila = un reporte guardado (definición JSON data-driven). Se almacena en la
 * BD de CADA proyecto (multi-tenant) porque el SQL del reporte corre contra esa
 * BD. El caller abre la conexión (getProjectConnection) y la cierra; aquí solo se
 * usa, igual que el patrón de catalog.ts.
 */

import type { Connection } from 'mysql2/promise';

export type ReportViz = 'table' | 'bar' | 'line' | 'pie' | 'kpi';

export interface ReportColumn {
    key: string;                                    // alias exacto de la columna en el SELECT
    label?: string;
    role: 'dimension' | 'measure' | 'temporal';
    format?: 'currency' | 'number' | 'percent' | 'date' | 'text';
}

// Parámetro de período: hace el reporte reutilizable (cambiar mes/año al abrirlo).
// El token {{key}} se usa dentro del SQL; SIEMPRE lleva el valor CALENDARIO (mes 1-12).
export interface ReportParam {
    key: string;                                    // nombre del token, ej. "month" / "year"
    label: string;                                  // etiqueta para el usuario
    type: 'month' | 'year';
    default?: number;                               // valor por defecto (mes 1-12 o año, ej. 2026)
}

export interface AdvancedReportDefinition {
    title: string;
    description?: string;
    sql: string;                                    // SELECT/WITH validado (sin ';' final); puede tener tokens {{...}}
    visualization: ReportViz;
    expectedColumns: ReportColumn[];
    insights: string[];
    parameters?: ReportParam[];                     // opcional; vacío = reporte fijo
    createdWith?: { model: string; createdAt: string };
}

export interface ReportListItem {
    idReporte: number;
    titulo: string;
    descripcion: string | null;
    visualization: string | null;
    modelo: string | null;
    fechaCreacion: string;
    idCarpeta: number | null;
}

export interface FolderItem {
    idCarpeta: number;
    nombre: string;
    total: number;                                  // reportes (no eliminados) en la carpeta
    fechaCreacion: string;
}

export interface ReportRecord {
    idReporte: number;
    definition: AdvancedReportDefinition;
    modelo: string | null;
    fechaCreacion: string;
}

// Caché POR BASE DE DATOS (multi-tenant): cada proyecto tiene su propia BD, así que un flag
// global haría que un 2º proyecto se saltara la creación de tablas. Se cachea por db name.
const ensuredDbs = new Set<string>();

export async function ensureReportsTable(conn: Connection): Promise<void> {
    const key = String((conn as any)?.config?.database || 'default');
    if (ensuredDbs.has(key)) return;
    await conn.query(`
        CREATE TABLE IF NOT EXISTS tblAgentReports (
            IdReporte      INT AUTO_INCREMENT PRIMARY KEY,
            Titulo         VARCHAR(300) NOT NULL,
            Descripcion    VARCHAR(1000) NULL,
            DefinicionJson MEDIUMTEXT NOT NULL,
            Visualization  VARCHAR(20) NULL,
            Modelo         VARCHAR(60) NULL,
            FechaCreacion  DATETIME NOT NULL,
            Eliminado      TINYINT NOT NULL DEFAULT 0,
            INDEX idx_estado (Eliminado, FechaCreacion)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(`
        CREATE TABLE IF NOT EXISTS tblAgentReportFolders (
            IdCarpeta     INT AUTO_INCREMENT PRIMARY KEY,
            Nombre        VARCHAR(120) NOT NULL,
            FechaCreacion DATETIME NOT NULL,
            Eliminado     TINYINT NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Migración idempotente: agrega IdCarpeta a tblAgentReports si la tabla ya existía sin ella.
    const [cols]: any = await conn.query(
        `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tblAgentReports' AND COLUMN_NAME = 'IdCarpeta'`
    );
    if (!cols?.[0]?.n) await conn.query(`ALTER TABLE tblAgentReports ADD COLUMN IdCarpeta INT NULL`);
    ensuredDbs.add(key);
}

export async function createReport(
    conn: Connection, def: AdvancedReportDefinition, model?: string
): Promise<number> {
    await ensureReportsTable(conn);
    const json = JSON.stringify(def).slice(0, 200000);
    const [res]: any = await conn.query(
        `INSERT INTO tblAgentReports (Titulo, Descripcion, DefinicionJson, Visualization, Modelo, FechaCreacion)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
            def.title.slice(0, 300),
            (def.description || '').slice(0, 1000) || null,
            json,
            def.visualization || 'table',
            model || null,
        ]
    );
    return res.insertId as number;
}

export async function listReports(conn: Connection): Promise<ReportListItem[]> {
    await ensureReportsTable(conn);
    const [rows] = await conn.query<any[]>(
        `SELECT IdReporte, Titulo, Descripcion, Visualization, Modelo, FechaCreacion, IdCarpeta
         FROM tblAgentReports WHERE Eliminado = 0 ORDER BY FechaCreacion DESC LIMIT 200`
    );
    return rows.map(r => ({
        idReporte: r.IdReporte,
        titulo: r.Titulo,
        descripcion: r.Descripcion ?? null,
        visualization: r.Visualization ?? null,
        modelo: r.Modelo ?? null,
        fechaCreacion: r.FechaCreacion instanceof Date ? r.FechaCreacion.toISOString() : String(r.FechaCreacion),
        idCarpeta: r.IdCarpeta ?? null,
    }));
}

export async function getReport(conn: Connection, id: number): Promise<ReportRecord | null> {
    await ensureReportsTable(conn);
    const [rows] = await conn.query<any[]>(
        `SELECT IdReporte, DefinicionJson, Modelo, FechaCreacion
         FROM tblAgentReports WHERE IdReporte = ? AND Eliminado = 0 LIMIT 1`,
        [id]
    );
    const r = rows?.[0];
    if (!r) return null;
    let definition: AdvancedReportDefinition;
    try { definition = JSON.parse(r.DefinicionJson); } catch { return null; }
    return {
        idReporte: r.IdReporte,
        definition,
        modelo: r.Modelo ?? null,
        fechaCreacion: r.FechaCreacion instanceof Date ? r.FechaCreacion.toISOString() : String(r.FechaCreacion),
    };
}

export async function deleteReport(conn: Connection, id: number): Promise<void> {
    await ensureReportsTable(conn);
    await conn.query(`UPDATE tblAgentReports SET Eliminado = 1 WHERE IdReporte = ?`, [id]);
}

// Mueve un reporte a una carpeta (idCarpeta) o lo saca de toda carpeta (null).
export async function moveReport(conn: Connection, id: number, idCarpeta: number | null): Promise<void> {
    await ensureReportsTable(conn);
    await conn.query(`UPDATE tblAgentReports SET IdCarpeta = ? WHERE IdReporte = ?`, [idCarpeta, id]);
}

// ──────────────────────────────── Carpetas ────────────────────────────────

export async function listFolders(conn: Connection): Promise<FolderItem[]> {
    await ensureReportsTable(conn);
    const [rows] = await conn.query<any[]>(
        `SELECT f.IdCarpeta, f.Nombre, f.FechaCreacion,
                (SELECT COUNT(*) FROM tblAgentReports r WHERE r.IdCarpeta = f.IdCarpeta AND r.Eliminado = 0) AS Total
         FROM tblAgentReportFolders f
         WHERE f.Eliminado = 0 ORDER BY f.Nombre ASC LIMIT 200`
    );
    return rows.map(r => ({
        idCarpeta: r.IdCarpeta,
        nombre: r.Nombre,
        total: Number(r.Total) || 0,
        fechaCreacion: r.FechaCreacion instanceof Date ? r.FechaCreacion.toISOString() : String(r.FechaCreacion),
    }));
}

export async function createFolder(conn: Connection, nombre: string): Promise<number> {
    await ensureReportsTable(conn);
    const name = String(nombre || '').trim().slice(0, 120);
    if (!name) throw new Error('El nombre de la carpeta es requerido.');
    const [res]: any = await conn.query(
        `INSERT INTO tblAgentReportFolders (Nombre, FechaCreacion) VALUES (?, NOW())`, [name]
    );
    return res.insertId as number;
}

export async function renameFolder(conn: Connection, id: number, nombre: string): Promise<void> {
    await ensureReportsTable(conn);
    const name = String(nombre || '').trim().slice(0, 120);
    if (!name) throw new Error('El nombre de la carpeta es requerido.');
    await conn.query(`UPDATE tblAgentReportFolders SET Nombre = ? WHERE IdCarpeta = ?`, [name, id]);
}

// Borra la carpeta (soft) y saca sus reportes a "Sin carpeta" (no los elimina).
export async function deleteFolder(conn: Connection, id: number): Promise<void> {
    await ensureReportsTable(conn);
    await conn.query(`UPDATE tblAgentReports SET IdCarpeta = NULL WHERE IdCarpeta = ?`, [id]);
    await conn.query(`UPDATE tblAgentReportFolders SET Eliminado = 1 WHERE IdCarpeta = ?`, [id]);
}

// ─────────────────────────── Parámetros (período) ───────────────────────────

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function defaultParamValue(p: ReportParam): number {
    if (typeof p.default === 'number' && Number.isFinite(p.default)) return Math.trunc(p.default);
    const now = new Date();
    return p.type === 'year' ? now.getFullYear() : now.getMonth() + 1; // mes calendario 1-12
}

function clampParam(p: ReportParam, v: number): number {
    if (p.type === 'month') return Math.min(12, Math.max(1, v));
    if (p.type === 'year') return Math.min(2100, Math.max(2000, v));
    return v;
}

/**
 * Sustituye los tokens {{key}} del SQL por valores ENTEROS validados.
 * Es seguro frente a inyección: solo se insertan enteros saneados (Math.trunc + clamp),
 * nunca texto del usuario. Si un parámetro no trae valor, usa su default.
 * Lanza error si quedan tokens sin declarar (reporte mal formado).
 */
export function resolveReportSql(
    def: { sql: string; parameters?: ReportParam[] },
    values?: Record<string, unknown>,
): string {
    let sql = String(def.sql || '');
    for (const p of def.parameters || []) {
        let v = defaultParamValue(p);
        const raw = values?.[p.key];
        if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
            const n = Math.trunc(Number(raw));
            if (Number.isFinite(n)) v = n;
        }
        v = clampParam(p, v);
        sql = sql.replace(new RegExp(`\\{\\{\\s*${escapeRe(p.key)}\\s*\\}\\}`, 'g'), String(v));
    }
    if (/\{\{\s*\w+\s*\}\}/.test(sql)) throw new Error('El reporte tiene parámetros sin definir.');
    return sql;
}

// Valida/normaliza los parámetros que entrega el agente (descarta basura).
export function sanitizeParams(arr: unknown): ReportParam[] {
    if (!Array.isArray(arr)) return [];
    const out: ReportParam[] = [];
    for (const raw of arr) {
        const p = raw as Record<string, unknown>;
        const key = String(p?.key || '').trim();
        const type = p?.type === 'year' ? 'year' : p?.type === 'month' ? 'month' : null;
        if (!key || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || !type) continue;
        const param: ReportParam = { key, label: String(p?.label || key).slice(0, 60), type };
        if (p?.default != null && Number.isFinite(Number(p.default))) param.default = Math.trunc(Number(p.default));
        out.push(param);
        if (out.length >= 6) break;
    }
    return out;
}
