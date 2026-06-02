/**
 * "Páginas de resultado compartibles" del agente.
 *
 * Guarda una respuesta (markdown, con sus bloques ```chart) bajo un token
 * impredecible para poder abrirla desde una liga pública (ej. enviada por
 * WhatsApp). Token de un solo uso de lectura, con expiración por privacidad.
 *
 * Se almacena en la BD MAESTRA (BDFoodieProjects) porque la liga se resuelve por
 * token sin conocer el proyecto de antemano.
 */

import { randomBytes } from 'crypto';
import pool from '@/lib/db';

const DEFAULT_TTL_DAYS = 7;
let ensured = false;

async function ensureTable(): Promise<void> {
    if (ensured) return;
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tblAgentShares (
            Token         VARCHAR(32)  NOT NULL PRIMARY KEY,
            IdProyecto    INT          NULL,
            Pregunta      VARCHAR(500) NULL,
            Contenido     MEDIUMTEXT   NOT NULL,
            Modelo        VARCHAR(60)  NULL,
            Sucursal      VARCHAR(245) NULL,
            FechaCreacion DATETIME     NOT NULL,
            FechaExpira   DATETIME     NULL,
            INDEX idx_expira (FechaExpira)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    ensured = true;
}

export interface ShareInput {
    content: string;
    question?: string;
    projectId?: number;
    model?: string;
    branchName?: string;
    ttlDays?: number;
}

export interface ShareRecord {
    token: string;
    content: string;
    question: string | null;
    projectId: number | null;
    model: string | null;
    branchName: string | null;
    createdAt: Date;
}

/** Guarda una respuesta y devuelve el token de la liga. */
export async function saveShare(input: ShareInput): Promise<string> {
    await ensureTable();
    const token = randomBytes(16).toString('base64url'); // 22 chars, URL-safe, impredecible
    const now = new Date();
    const ttl = input.ttlDays ?? DEFAULT_TTL_DAYS;
    const expira = ttl > 0 ? new Date(now.getTime() + ttl * 86400000) : null;

    await pool.query(
        `INSERT INTO tblAgentShares
            (Token, IdProyecto, Pregunta, Contenido, Modelo, Sucursal, FechaCreacion, FechaExpira)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            token,
            input.projectId ?? null,
            input.question ? input.question.slice(0, 500) : null,
            input.content,
            input.model ?? null,
            input.branchName ?? null,
            now,
            expira,
        ]
    );
    return token;
}

/** Resuelve una liga por token. Devuelve null si no existe o expiró. */
export async function getShare(token: string): Promise<ShareRecord | null> {
    await ensureTable();
    const [rows] = await pool.query<any[]>(
        `SELECT Token, IdProyecto, Pregunta, Contenido, Modelo, Sucursal, FechaCreacion, FechaExpira
         FROM tblAgentShares WHERE Token = ? LIMIT 1`,
        [token]
    );
    const r = rows?.[0];
    if (!r) return null;
    if (r.FechaExpira && new Date(r.FechaExpira).getTime() < Date.now()) return null; // expirada

    return {
        token: r.Token,
        content: r.Contenido,
        question: r.Pregunta ?? null,
        projectId: r.IdProyecto ?? null,
        model: r.Modelo ?? null,
        branchName: r.Sucursal ?? null,
        createdAt: new Date(r.FechaCreacion),
    };
}
