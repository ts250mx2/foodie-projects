import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import pool from '@/lib/db';
import { getProjectConnection } from '@/lib/dynamic-db';
import { buildProjectCatalog } from '@/lib/ai/catalog';
import { saveShare } from '@/lib/ai/shares';
import { buildSystemPrompt, AGENT_TOOLS as WEB_AGENT_TOOLS } from '@/app/api/ai/chat/route';

/**
 * POST /api/whatsapp/ask  — agente Foodie Guru por WhatsApp (estilo Integra Gym).
 *
 * Lo llama un bridge de WhatsApp (Twilio / Meta Cloud API / n8n / Worker) con la
 * pregunta y el número que la envía; devuelve una respuesta corta lista para el
 * chat. Para datos tabulares emite un bloque `report` que se guarda como liga
 * compartible y se anexa al mensaje (texto corto + 📊 link al detalle).
 *
 * Multi-tenant: resuelve el proyecto por el número en tblProyectosTelefonos
 * (IdProyecto → tblProyectos → BD del proyecto). Si el número tiene varios
 * proyectos, devuelve un menú y recuerda la elección.
 *
 * Body: { question, from_phone, projectId?, reset?, timestamp? }
 * Auth: header X-API-Key === WHATSAPP_API_KEY.
 */

const MAX_TURNS = 8;
const PENDING_TTL_MS = 10 * 60 * 1000;
const ANSWER_CAP = 100;      // Si la respuesta supera este límite → se envía link del reporte
const REPORT_THRESHOLD = 100; // chars: umbral para forzar generación de reporte
const WA_MODEL = process.env.WHATSAPP_AI_MODEL || 'claude-sonnet-4-6';
const WA_FALLBACK_MODEL = 'claude-haiku-4-5-20251001';
const SHARE_LOCALE = 'es';

interface WhatsAppRequest {
    question?: string;
    from_phone?: string;
    projectId?: number | string;
    reset?: boolean;
    timestamp?: string;
}

interface PhoneProject { IdProyecto: number; Proyecto: string; projectUuid: string; }

interface PendingChoice { question: string; options: PhoneProject[]; expires: number; }
const PENDING = new Map<string, PendingChoice>();

// ─── Helpers de teléfono ───────────────────────────────────────────────────────
const digits = (s: string) => (s || '').replace(/\D/g, '');
const last10 = (s: string) => digits(s).slice(-10);
const normPhoneSql = (col: string) =>
    `RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${col},' ',''),'-',''),'(',''),')',''),'+',''),'.','') , 10)`;

// ─── Proyecto activo por teléfono (tabla propia, no invade tblProyectosUsuarios) ─
let activoEnsured = false;
async function ensureActivoTable(): Promise<void> {
    if (activoEnsured) return;
    await pool.query(`CREATE TABLE IF NOT EXISTS tblWhatsappActivo (
        Telefono   VARCHAR(20) NOT NULL PRIMARY KEY,
        IdProyecto INT         NOT NULL,
        FechaAct   DATETIME    NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    activoEnsured = true;
}
async function getActiveProjectId(phone: string): Promise<number | null> {
    await ensureActivoTable();
    const [rows] = await pool.query<any[]>(
        `SELECT IdProyecto FROM tblWhatsappActivo WHERE Telefono = ? LIMIT 1`, [last10(phone)]
    );
    return rows?.[0]?.IdProyecto ?? null;
}
async function setActiveProject(phone: string, idProyecto: number): Promise<void> {
    await ensureActivoTable();
    await pool.query(
        `INSERT INTO tblWhatsappActivo (Telefono, IdProyecto, FechaAct) VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE IdProyecto = VALUES(IdProyecto), FechaAct = NOW()`,
        [last10(phone), idProyecto]
    );
}
async function clearActiveProject(phone: string): Promise<void> {
    await ensureActivoTable();
    await pool.query(`DELETE FROM tblWhatsappActivo WHERE Telefono = ?`, [last10(phone)]);
}

// ─── Lookup de proyectos por número ────────────────────────────────────────────
// El número que envía la pregunta se mapea en BDFoodieProjects.tblProyectosTelefonos
// (la pantalla "WhatsApp's" de cada proyecto). El IdProyecto asignado decide a qué BD
// se conecta el agente para responder. Un mismo número puede estar en varios proyectos.
async function findProjectsForPhone(phone: string): Promise<PhoneProject[]> {
    const tail = last10(phone);
    if (tail.length < 8) return [];
    const [rows] = await pool.query<any[]>(
        `SELECT DISTINCT p.IdProyecto, p.Proyecto, p.UUID AS projectUuid
         FROM tblProyectosTelefonos t
         JOIN tblProyectos p ON t.IdProyecto = p.IdProyecto
         WHERE ${normPhoneSql('t.Telefono')} = ? AND COALESCE(p.Status,0) <> 2
         ORDER BY p.Proyecto ASC`,
        [tail]
    );
    const seen = new Set<number>();
    const out: PhoneProject[] = [];
    for (const r of rows) {
        const id = Number(r.IdProyecto);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ IdProyecto: id, Proyecto: String(r.Proyecto || `Proyecto ${id}`), projectUuid: String(r.projectUuid || '') });
    }
    return out;
}

// ─── Tool ──────────────────────────────────────────────────────────────────────
// ─── DB Query Execution ────────────────────────────────────────────────────────
async function executeQuery(conn: any, sql: string): Promise<any[]> {
    const t = sql.toLowerCase().trim();
    if (!t.startsWith('select') && !t.startsWith('with')) throw new Error('Solo se permiten consultas SELECT / WITH.');
    const [rows] = await conn.execute(sql);
    return rows as any[];
}

async function runToolBlocks(conn: any, content: any[], executedSql: string[]): Promise<any[]> {
    const out: any[] = [];
    for (const block of content) {
        if (block.type !== 'tool_use') continue;
        if (block.name === 'query_database') {
            const sql = String((block.input as any)?.sql || '').replace(/```sql|```/g, '').trim();
            if (sql) executedSql.push(sql);
            try {
                const rows = await executeQuery(conn, sql);
                const s = JSON.stringify(rows);
                out.push({ type: 'tool_result', tool_use_id: block.id, content: s.length > 12000 ? s.slice(0, 12000) + '…]' : s });
            } catch (err: any) {
                out.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ error: err.message }), is_error: true });
            }
        }
    }
    return out;
}

async function createWithFallback(anthropic: Anthropic, params: any, primary: string): Promise<{ msg: Anthropic.Message; model: string }> {
    const chain = primary === WA_FALLBACK_MODEL ? [WA_FALLBACK_MODEL] : [primary, WA_FALLBACK_MODEL];
    let lastErr: any;
    for (let i = 0; i < chain.length; i++) {
        try {
            const msg = await anthropic.messages.create({ ...params, model: chain[i] });
            return { msg, model: chain[i] };
        } catch (err: any) {
            lastErr = err;
            const status = err?.status ?? err?.response?.status;
            const transient = !status || status >= 500 || status === 429;
            if (i < chain.length - 1 && transient) continue;
            throw err;
        }
    }
    throw lastErr;
}

async function runAgent(projectId: number, projectName: string, question: string):
    Promise<{ answer: string; executedSql: string[]; model: string }> {
    let conn: any = null;
    try {
        conn = await getProjectConnection(projectId);
        let projectCatalog = '';
        try { projectCatalog = await buildProjectCatalog(conn, String(projectId)); }
        catch (e) { console.error('[whatsapp/ask] catálogo falló:', e); }

        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        
        // Contexto para el prompt del sistema (Zona horaria Monterrey/México)
        const now = new Date();
        const f = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Monterrey', year: 'numeric', month: 'numeric', day: 'numeric' });
        const parts = f.formatToParts(now);
        const gp = (t: string) => Number(parts.find(p => p.type === t)?.value || 0);
        const m = gp('month'), y = gp('year');
        const context = {
            todayMonth: m,
            todayYear: y,
            dashboardMonth: m,
            dashboardYear: y,
            branchId: '',
        };

        const system = buildSystemPrompt(context, projectCatalog);
        const executedSql: string[] = [];
        const messages: { role: 'user' | 'assistant'; content: any }[] = [{ role: 'user', content: question }];

        let finalText = '';
        let modelUsed = WA_MODEL;
        let turns = 0;

        while (turns < MAX_TURNS) {
            turns++;
            const { msg, model } = await createWithFallback(anthropic, {
                max_tokens: 8192, system, tools: WEB_AGENT_TOOLS, tool_choice: { type: 'auto' }, messages,
            }, modelUsed);
            modelUsed = model;

            const tb = msg.content.find((c: any) => c.type === 'text') as any;
            if (tb?.text) finalText = tb.text;
            
            if (msg.stop_reason !== 'tool_use') break;

            // Manejo de ask_clarification en WhatsApp
            const clarificationBlock = msg.content.find(
                (c: any) => c.type === 'tool_use' && c.name === 'ask_clarification'
            );
            if (clarificationBlock?.type === 'tool_use') {
                const input = clarificationBlock.input as any;
                const quest = input.question || '¿Qué período te gustaría analizar?';
                const suggestions = input.suggestions || [];
                const suggestionsText = suggestions.length > 0
                    ? `\n\nSugerencias:\n${suggestions.map((s: string) => `• ${s}`).join('\n')}`
                    : '';
                finalText = `${quest}${suggestionsText}`;
                break;
            }

            messages.push({ role: 'assistant', content: msg.content });
            const toolResults = await runToolBlocks(conn, msg.content, executedSql);
            messages.push({ role: 'user', content: toolResults });
        }

        return { answer: finalText || 'No pude generar una respuesta. ¿Puedes reformular tu pregunta?', executedSql, model: modelUsed };
    } finally {
        if (conn) { try { await conn.end(); } catch { /* noop */ } }
    }
}

async function summarizeForWhatsApp(anthropic: Anthropic, originalQuestion: string, fullResponse: string): Promise<string> {
    try {
        const { msg } = await createWithFallback(anthropic, {
            max_tokens: 150,
            system: "Eres un asistente que resume la respuesta de un agente consultor de restaurantes para enviarla por WhatsApp.\n" +
                    "Escribe un único titular directo sin formato (sin **, sin #, sin viñetas, sin markdown) que contenga la métrica o dato clave más relevante.\n" +
                    "Debe ser extremadamente conciso: máximo 90 caracteres de longitud. Escribe en español.\n" +
                    "Ejemplo: 'Ventas de mayo: $182,400 (8% más vs abril) 📈'",
            messages: [
                { role: 'user', content: `Pregunta: "${originalQuestion}"\n\nRespuesta:\n${fullResponse}` }
            ]
        }, WA_FALLBACK_MODEL);
        const textBlock = msg.content.find((c: any) => c.type === 'text') as any;
        let summary = (textBlock?.text || '').trim();
        // Limpiar markdown residual
        summary = summary.replace(/[#*`>|]/g, '').replace(/\s+/g, ' ').trim();
        if (summary.length > 100) {
            summary = summary.slice(0, 97) + '...';
        }
        return summary;
    } catch (e) {
        console.error('Error al resumir para WhatsApp:', e);
        // Fallback simple: extraer primera línea/frase y truncar
        const firstLine = fullResponse.split('\n')[0].replace(/[#*`>|]/g, '').trim();
        return firstLine.slice(0, 97) + '...';
    }
}


function computeBaseUrl(req: Request): string {
    const env = (process.env.APP_PUBLIC_URL || '').trim().replace(/\/$/, '');
    if (env) return env;
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    if (host) return `${proto}://${host}`;
    try { return new URL(req.url).origin; } catch { return ''; }
}

function resolveSelection(text: string, options: PhoneProject[]): PhoneProject | null {
    const t = text.trim().toLowerCase();
    if (/^\s*\d+\s*$/.test(t)) {
        const num = parseInt(t, 10);
        if (num >= 1 && num <= options.length) return options[num - 1];
    }
    const matches = options.filter(o => o.Proyecto.toLowerCase().includes(t) || t.includes(o.Proyecto.toLowerCase()));
    return matches.length === 1 ? matches[0] : null;
}
function menuText(options: PhoneProject[]): string {
    return `Tu número tiene acceso a varios negocios. ¿Sobre cuál quieres consultar? Responde con el número:\n${options.map((o, i) => `${i + 1}. ${o.Proyecto}`).join('\n')}`;
}
function isResetCmd(text: string): boolean {
    const t = text.trim().toLowerCase();
    return ['cambiar', 'cambiar negocio', 'cambiar proyecto', 'otro negocio', 'otro proyecto', 'menu', 'menú', 'salir', 'reset']
        .some(k => t === k || t.startsWith(k + ' '));
}

export async function POST(req: Request) {
    const startTime = Date.now();
    const requestId = `wa_${startTime.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    try {
        const expectedKey = process.env.WHATSAPP_API_KEY;
        if (!expectedKey) return NextResponse.json({ error: 'WhatsApp endpoint no configurado (falta WHATSAPP_API_KEY)' }, { status: 503 });
        const providedKey = req.headers.get('x-api-key');
        if (!providedKey || providedKey !== expectedKey) return NextResponse.json({ error: 'API key inválida o ausente' }, { status: 401 });

        const body: WhatsAppRequest = await req.json();
        const question = (body.question || '').trim();
        const fromPhone = (body.from_phone || '').trim();
        if (!fromPhone) return NextResponse.json({ error: 'Falta from_phone' }, { status: 400 });
        if (!question) return NextResponse.json({ error: 'Falta question' }, { status: 400 });
        if (question.length > 600) return NextResponse.json({ error: 'question demasiado larga (max 600)' }, { status: 400 });

        const phoneKey = last10(fromPhone);
        const baseUrl = computeBaseUrl(req);
        console.log(`[${requestId}] whatsapp ask from=${fromPhone} q="${question.slice(0, 80)}"`);

        if (body.reset || isResetCmd(question)) {
            await clearActiveProject(fromPhone);
            PENDING.delete(phoneKey);
        }

        const projects = await findProjectsForPhone(fromPhone);
        if (projects.length === 0) {
            return NextResponse.json({
                answer: 'Este número no está asignado a ningún negocio Foodie Guru.',
                meta: { request_id: requestId, from_phone: fromPhone, elapsed_ms: Date.now() - startTime },
            });
        }
        const allowedIds = new Set(projects.map(p => p.IdProyecto));
        let active: PhoneProject | null = null;

        if (body.projectId != null && allowedIds.has(Number(body.projectId))) {
            active = projects.find(p => p.IdProyecto === Number(body.projectId)) || null;
        }

        if (!active) {
            const pend = PENDING.get(phoneKey);
            if (pend && pend.expires > Date.now()) {
                const picked = resolveSelection(question, pend.options);
                if (picked) {
                    PENDING.delete(phoneKey);
                    if (!pend.question || isResetCmd(pend.question)) {
                        await setActiveProject(fromPhone, picked.IdProyecto);
                        return NextResponse.json({
                            answer: `Listo, ahora consultas sobre ${picked.Proyecto}. ¿Qué quieres saber?`,
                            project: { idProyecto: picked.IdProyecto, nombre: picked.Proyecto },
                            meta: { request_id: requestId, from_phone: fromPhone, elapsed_ms: Date.now() - startTime },
                        });
                    }
                    return await answerForProject(picked, pend.question, fromPhone, requestId, startTime, true, baseUrl);
                }
                PENDING.set(phoneKey, { question, options: projects, expires: Date.now() + PENDING_TTL_MS });
                return NextResponse.json({
                    answer: `No reconocí esa opción. ${menuText(projects)}`,
                    needsSelection: true,
                    options: projects.map((p, i) => ({ index: i + 1, projectId: p.IdProyecto, name: p.Proyecto })),
                    meta: { request_id: requestId, from_phone: fromPhone, elapsed_ms: Date.now() - startTime },
                });
            }
        }

        if (!active) {
            const activeId = await getActiveProjectId(fromPhone);
            if (activeId != null && allowedIds.has(activeId)) active = projects.find(p => p.IdProyecto === activeId) || null;
        }
        if (!active && projects.length === 1) active = projects[0];

        if (!active) {
            PENDING.set(phoneKey, { question, options: projects, expires: Date.now() + PENDING_TTL_MS });
            return NextResponse.json({
                answer: menuText(projects),
                needsSelection: true,
                options: projects.map((p, i) => ({ index: i + 1, projectId: p.IdProyecto, name: p.Proyecto })),
                meta: { request_id: requestId, from_phone: fromPhone, elapsed_ms: Date.now() - startTime },
            });
        }

        return await answerForProject(active, question, fromPhone, requestId, startTime, false, baseUrl);
    } catch (e: any) {
        console.error(`[${requestId}] error:`, e);
        return NextResponse.json({
            answer: 'Tuve un problema técnico. ¿Puedes intentar de nuevo en un momento?',
            error: e?.message || 'Error desconocido',
        }, { status: 500 });
    }
}

async function answerForProject(
    project: PhoneProject, question: string, fromPhone: string,
    requestId: string, startTime: number, justSelected: boolean, baseUrl: string
): Promise<Response> {
    await setActiveProject(fromPhone, project.IdProyecto);

    const { answer, executedSql, model } = await runAgent(project.IdProyecto, project.Proyecto, question);
    if (executedSql.length) console.log(`[${requestId}] project=${project.IdProyecto} SQL: ${executedSql.join(' | ').slice(0, 240)}`);

    const rawAnswer = answer || 'No pude generar una respuesta. ¿Puedes reformular tu pregunta?';
    const prefix    = justSelected ? `📍 ${project.Proyecto}\n` : '';

    const hasTableOrChart = rawAnswer.includes('|') || rawAnswer.includes('```chart') || rawAnswer.includes('```nav');
    const needsReport = rawAnswer.length > ANSWER_CAP || hasTableOrChart;

    let finalAnswer = '';
    let reportUrl: string | null = null;

    if (needsReport) {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const summary = await summarizeForWhatsApp(anthropic, question, rawAnswer);
        
        finalAnswer = prefix + summary;

        try {
            const token = await saveShare({
                content: rawAnswer,
                question,
                projectId: project.IdProyecto,
                model,
                branchName: project.Proyecto,
            });
            if (baseUrl) {
                reportUrl    = `${baseUrl}/${SHARE_LOCALE}/r/${token}`;
                finalAnswer += `\n\n📊 Ver análisis completo: ${reportUrl}`;
            }
        } catch (e) {
            console.error(`[${requestId}] no se pudo guardar el reporte:`, e);
            const cleanText = rawAnswer.replace(/[#*`>|]/g, '').replace(/\s+/g, ' ').trim();
            finalAnswer = (prefix + cleanText).slice(0, 500) + '...';
        }
    } else {
        const cleanText = rawAnswer.replace(/[#*`>|]/g, '').replace(/\s+/g, ' ').trim();
        finalAnswer = (prefix + cleanText).trim();
    }

    return NextResponse.json({
        answer: finalAnswer,
        project: { idProyecto: project.IdProyecto, nombre: project.Proyecto },
        reportUrl,
        meta: {
            request_id: requestId, from_phone: fromPhone, model_used: model,
            rows_queries: executedSql.length, has_report: !!reportUrl,
            answer_length: rawAnswer.length, used_threshold: needsReport,
            elapsed_ms: Date.now() - startTime,
        },
    });
}

