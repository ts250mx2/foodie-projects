import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import pool from '@/lib/db';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { Connection } from 'mysql2/promise';

export const runtime = 'nodejs';
// La sincronización completa (varias sucursales × 21 reportes) puede tardar varios
// minutos; ampliamos el límite de la función.
export const maxDuration = 600;

const SCRAPER_DIR = path.join(process.cwd(), 'wansoft-scraper');
const SYNC_TIMEOUT_MS = Number(process.env.POS_SYNC_TIMEOUT_MS) || 8 * 60 * 1000;

/** Crea la tabla de bitácora de sincronizaciones si no existe. */
async function ensureSyncLogTable(connection: Connection) {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS \`tblPOSSyncLog\` (
          \`IdLog\` INT NOT NULL AUTO_INCREMENT,
          \`Fecha\` DATETIME NOT NULL,
          \`Tipo\` VARCHAR(100) NOT NULL DEFAULT 'Sincronización',
          \`Status\` VARCHAR(20) NOT NULL DEFAULT 'success',
          \`Records\` INT NOT NULL DEFAULT 0,
          \`Duration\` VARCHAR(20) NULL,
          \`Detail\` TEXT NULL,
          PRIMARY KEY (\`IdLog\`),
          KEY \`idx_fecha\` (\`Fecha\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
}

interface ScrapeSummary {
    fecha: string;
    sucursales: number;
    consolidado: number;
    reportes: Record<string, number | string>;
    errores: string[];
    fatal?: string;
}

/** Lanza scrape-all.mjs como proceso hijo y resuelve con su salida. */
function runScraper(
    env: NodeJS.ProcessEnv,
    args: string[]
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [path.join(SCRAPER_DIR, 'scrape-all.mjs'), ...args], {
            cwd: SCRAPER_DIR,
            env,
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, SYNC_TIMEOUT_MS);

        child.stdout.on('data', (d) => { stdout += d.toString(); });
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        child.on('error', (err) => {
            clearTimeout(timer);
            resolve({ code: -1, stdout, stderr: stderr + '\n' + err.message, timedOut });
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ code, stdout, stderr, timedOut });
        });
    });
}

/** Extrae la línea "SUMMARY {json}" que imprime el scraper. */
function parseSummary(stdout: string): ScrapeSummary | null {
    const lines = stdout.split('\n').filter((l) => l.includes('SUMMARY '));
    if (!lines.length) return null;
    const last = lines[lines.length - 1];
    const json = last.slice(last.indexOf('SUMMARY ') + 'SUMMARY '.length).trim();
    try {
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, date, branchId, only } = body;

        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        // 1) Credenciales de la BD del proyecto (para que el scraper guarde ahí).
        const [projRows] = await pool.query<any[]>(
            'SELECT * FROM tblProyectos WHERE IdProyecto = ?',
            [parseInt(projectId)]
        );
        if (!projRows.length) {
            return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 404 });
        }
        const project = projRows[0];
        const dbUser = project.UsuarioBD || project.UsarioBD;
        const dbPass = project.PasswordBD || project.PasswdBD;

        // 2) Configuración del POS (credenciales Wansoft).
        connection = await getProjectConnection(parseInt(projectId));
        await ensureSyncLogTable(connection);

        const [cfgRows]: any = await connection.query('SELECT * FROM tblPOSConfig LIMIT 1');
        const config = cfgRows[0];

        if (!config || config.Provider !== 'wansoft') {
            return NextResponse.json({
                success: false,
                message: 'La sincronización automática sólo está disponible con el proveedor Wansoft. Guarda la configuración con Wansoft seleccionado.',
            }, { status: 400 });
        }
        if (!config.User || !config.Password) {
            return NextResponse.json({
                success: false,
                message: 'Faltan credenciales de Wansoft (Usuario y Contraseña). Guárdalas antes de sincronizar.',
            }, { status: 400 });
        }

        // 3) Disparar el scraper con las credenciales del proyecto.
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            WANSOFT_URL: config.Url || 'https://www.wansoft.net/Wansoft.Web/',
            WANSOFT_USER: config.User,
            WANSOFT_PASS: config.Password,
            DB_HOST: project.Servidor,
            DB_USER: dbUser,
            DB_PASSWORD: dbPass,
            DB_NAME: project.BaseDatos,
            DB_PORT: String(project.Puerto || 3306),
            HEADFUL: '0',
        };
        if (date) env.DATE = String(date);

        const args: string[] = [];
        if (branchId) args.push(`--branch=${branchId}`);
        if (Array.isArray(only) && only.length) args.push(`--only=${only.join(',')}`);

        const started = Date.now();
        const { code, stdout, stderr, timedOut } = await runScraper(env, args);
        const durationSec = ((Date.now() - started) / 1000).toFixed(1);

        const summary = parseSummary(stdout);
        const success = code === 0 && !timedOut && !!summary && !summary.fatal;

        const records = summary
            ? Object.values(summary.reportes).reduce<number>((s, n) => s + (Number(n) || 0), 0) + (summary.sucursales || 0)
            : 0;

        const detail = timedOut
            ? `Tiempo de espera agotado (${SYNC_TIMEOUT_MS / 1000}s).`
            : JSON.stringify(summary ?? { stderr: stderr.slice(-800) }).slice(0, 4000);

        const tipo = branchId ? 'Sincronización (1 sucursal)' : 'Sincronización completa';

        // 4) Registrar en bitácora y actualizar estado del POS.
        await connection.query(
            `INSERT INTO tblPOSSyncLog (Fecha, Tipo, Status, Records, Duration, Detail)
             VALUES (NOW(), ?, ?, ?, ?, ?)`,
            [tipo, success ? 'success' : 'failed', records, `${durationSec}s`, detail]
        );
        await connection.query(
            `UPDATE tblPOSConfig SET LastSync = NOW(), Status = ? WHERE 1`,
            [success ? 'connected' : 'error']
        );

        return NextResponse.json({
            success,
            message: success
                ? `Sincronización completada: ${records} registros en ${durationSec}s.`
                : timedOut
                    ? 'La sincronización excedió el tiempo de espera.'
                    : `La sincronización falló${summary?.fatal ? `: ${summary.fatal}` : ''}.`,
            summary,
            duration: `${durationSec}s`,
            records,
            stderr: success ? undefined : stderr.slice(-800),
        });
    } catch (error: any) {
        console.error('Error running POS sync:', error);
        return NextResponse.json({ success: false, message: error?.message || 'Error al sincronizar' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));
        await ensureSyncLogTable(connection);

        const [rows]: any = await connection.query(
            'SELECT IdLog, Fecha, Tipo, Status, Records, Duration FROM tblPOSSyncLog ORDER BY Fecha DESC LIMIT 15'
        );
        return NextResponse.json({ success: true, data: rows });
    } catch (error: any) {
        console.error('Error fetching sync logs:', error);
        return NextResponse.json({ success: false, message: 'Error fetching sync logs' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
