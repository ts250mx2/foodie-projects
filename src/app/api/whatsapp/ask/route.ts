import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import pool from '@/lib/db';
import { getProjectConnection } from '@/lib/dynamic-db';
import { DATABASE_SCHEMA } from '@/lib/ai/schema';
import { buildProjectCatalog } from '@/lib/ai/catalog';
import { saveShare } from '@/lib/ai/shares';
import { reportToMarkdown, reportHasContent, AgentReport } from '@/lib/ai/report';

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
const AGENT_TOOLS: any[] = [{
    name: 'query_database',
    description: `Ejecuta SQL SELECT/WITH de solo lectura contra la BD MySQL del restaurante.
- Ventas por canal: tblVentasCanalesVenta JOIN tblCanalesVenta. Por forma de pago: tblVentasTerminales JOIN tblTerminales. NUNCA tblVentas.
- Productos: vlProductos. Status=2 = anulado: filtra Status <> 2.
- MES: respeta la "CONVENCIÓN DE MES (detectada en vivo)" del catálogo (ventas suelen ser 0-11; gastos/inventarios 1-12).
- MySQL: LIMIT obligatorio. Encadena varias llamadas para explorar/aislar antes de responder.`,
    input_schema: {
        type: 'object',
        properties: { sql: { type: 'string', description: 'SELECT o WITH. Un statement. Sin ; al final. Con LIMIT.' } },
        required: ['sql'],
    },
}];

async function executeQuery(conn: any, sql: string): Promise<any[]> {
    const t = sql.toLowerCase().trim();
    if (!t.startsWith('select') && !t.startsWith('with')) throw new Error('Solo se permiten consultas SELECT / WITH.');
    const [rows] = await conn.execute(sql);
    return rows as any[];
}

async function runToolBlocks(conn: any, content: any[], executedSql: string[], capture: { lastRows: any[] }): Promise<any[]> {
    const out: any[] = [];
    for (const block of content) {
        if (block.type !== 'tool_use') continue;
        const sql = String((block.input as any)?.sql || '').replace(/```sql|```/g, '').trim();
        if (sql) executedSql.push(sql);
        try {
            const rows = await executeQuery(conn, sql);
            if (Array.isArray(rows) && rows.length > 0) capture.lastRows = rows;
            const s = JSON.stringify(rows);
            out.push({ type: 'tool_result', tool_use_id: block.id, content: s.length > 12000 ? s.slice(0, 12000) + '…]' : s });
        } catch (err: any) {
            out.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ error: err.message }), is_error: true });
        }
    }
    return out;
}

function buildWaSystemPrompt(projectCatalog: string, projectName: string): string {
    const now = new Date();
    const f = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Monterrey', year: 'numeric', month: 'numeric', day: 'numeric' });
    const parts = f.formatToParts(now);
    const gp = (t: string) => Number(parts.find(p => p.type === t)?.value || 0);
    const m = gp('month'), y = gp('year');
    const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
    const names = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    return `Eres el AGENTE FOODIE GURU respondiendo por WhatsApp para "${projectName || 'tu restaurante'}".
Consultor experto en rentabilidad y operación de restaurantes. Tienes acceso de SOLO LECTURA a la BD del negocio vía query_database.

FECHA DE HOY (zona centro de México): ${names[m]} ${y} (mes calendario ${m}).
PERÍODO (en meses CALENDARIO; conviértelos a la convención de cada tabla según el catálogo):
  - "este mes" → ${names[m]} ${y} (calendario ${m})
  - "mes pasado" → ${names[pm]} ${py} (calendario ${pm})

${DATABASE_SCHEMA}

${projectCatalog}

──────────────────────────────────────────────────────────────
CÓMO RESPONDES
──────────────────────────────────────────────────────────────
- Si la pregunta involucra datos (ventas, gastos, compras, nómina, inventario, productos) → USA query_database. Nunca digas "no tengo acceso".
- Encadena consultas si necesitas explorar IDs/nombres o aislar una causa.
- Para saludos o "¿qué puedes hacer?" responde directo, breve y cordial, sin consultar.
- Nunca inventes cifras; si una consulta sale vacía revisa el filtro (sucursal, Status, convención de mes) y reintenta antes de decir que no hay datos.

──────────────────────────────────────────────────────────────
FORMATO WHATSAPP — REGLA DE ORO
──────────────────────────────────────────────────────────────
El texto que envías por WhatsApp SIEMPRE debe ser una sola frase titular ≤ 100 caracteres
con el dato más importante (ej. "Ventas mayo: $182,400 📈+8% vs abril").
Todo el análisis, tablas, gráficas y desglose van en el bloque report (ver abajo).

- TEXTO PLANO: sin markdown, sin **, sin #, sin viñetas. Emojis ligeros están bien.
- Cifras en MXN con coma de miles ($14,820.00). Tutea, tono directo.
- Responde SIEMPRE en español.
- Para saludos o preguntas conceptuales: responde natural y breve, sin report.

──────────────────────────────────────────────────────────────
DETALLE VISUAL — bloque report (SIEMPRE que haya datos)
──────────────────────────────────────────────────────────────
CUALQUIER respuesta con datos numéricos DEBE incluir un bloque report con el análisis
completo: tablas con todas las filas relevantes y gráficas cuando aporten.

\`\`\`report
{"title":"Ventas por canal (mayo 2026)","tables":[{"title":"Detalle","columns":["Canal","Venta"],"rows":[["Comedor",1382567],["Uber",111322]]}],"charts":[{"type":"bar","title":"Ventas por canal","format":"currency","data":[{"name":"Comedor","value":1382567},{"name":"Uber","value":111322}]}]}
\`\`\`

REGLAS DEL BLOQUE report:
- SIEMPRE en respuestas con datos: una tabla por cada dimensión analizada + gráfica cuando haya comparativa.
- El texto de WhatsApp es SOLO el titular (≤ 100 chars). El detalle va en el link.
- "charts": "type" bar|line|pie, "format" currency|number|percent, valores crudos (sin $, comas ni %).
- Puedes incluir análisis de texto enriquecido (con **negritas** y saltos de línea) dentro del JSON en un campo "analysis": "texto del análisis completo".
- Omite el bloque SOLO para saludos, preguntas conceptuales o respuesta de un solo número sin contexto.
- NO menciones el link en el texto; el sistema lo agrega automáticamente.`;
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
    Promise<{ answer: string; report: AgentReport | null; executedSql: string[]; model: string }> {
    let conn: any = null;
    try {
        conn = await getProjectConnection(projectId);
        let projectCatalog = '';
        try { projectCatalog = await buildProjectCatalog(conn, String(projectId)); }
        catch (e) { console.error('[whatsapp/ask] catálogo falló:', e); }

        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const system = buildWaSystemPrompt(projectCatalog, projectName);
        const executedSql: string[] = [];
        const messages: { role: 'user' | 'assistant'; content: any }[] = [{ role: 'user', content: question }];
        const capture = { lastRows: [] as any[] };

        let finalText = '';
        let modelUsed = WA_MODEL;
        let turns = 0;

        while (turns < MAX_TURNS) {
            turns++;
            const { msg, model } = await createWithFallback(anthropic, {
                max_tokens: 1500, system, tools: AGENT_TOOLS, tool_choice: { type: 'auto' }, messages,
            }, modelUsed);
            modelUsed = model;

            const tb = msg.content.find((c: any) => c.type === 'text') as any;
            if (tb?.text) finalText = tb.text;
            if (msg.stop_reason !== 'tool_use') break;

            messages.push({ role: 'assistant', content: msg.content });
            const toolResults = await runToolBlocks(conn, msg.content, executedSql, capture);
            messages.push({ role: 'user', content: toolResults });
        }

        const ex = extractReport(finalText);
        const report = ex.report || buildFallbackReport(capture.lastRows);
        return { answer: ex.clean.slice(0, ANSWER_CAP), report, executedSql, model: modelUsed };
    } finally {
        if (conn) { try { await conn.end(); } catch { /* noop */ } }
    }
}

function extractReport(text: string): { clean: string; report: AgentReport | null } {
    let report: AgentReport | null = null;
    let clean = text || '';
    const m = clean.match(/```report\s*([\s\S]*?)```/i);
    if (m) {
        try { report = JSON.parse(m[1].trim()); } catch { report = null; }
        clean = clean.replace(m[0], '').trim();
    }
    clean = clean.replace(/```[\s\S]*?```/g, '').trim(); // limpia otros bloques colados
    return { clean, report: reportHasContent(report) ? report : null };
}

// Respaldo: arma una tabla con las filas de la última consulta si el modelo no
// emitió el bloque report (garantiza el link en respuestas tipo lista).
function buildFallbackReport(rows: any[]): AgentReport | null {
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const sample = rows.slice(0, 200);
    const first = sample[0];
    if (!first || typeof first !== 'object') return null;
    const cols = Object.keys(first).filter(k => {
        const v = first[k];
        return !(v && typeof v === 'object' && !(v instanceof Date));
    });
    if (cols.length < 1) return null;
    const sane = (v: any) => {
        if (v === null || v === undefined) return '';
        if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
        if (typeof v === 'object') return '';
        return v;
    };
    return { title: null, tables: [{ columns: cols, rows: sample.map(r => cols.map(c => sane(r[c]))) }], charts: [] };
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

// Convierte el texto completo del agente en un AgentReport básico para el link de resumen.
// Se usa cuando la respuesta supera REPORT_THRESHOLD pero el modelo no emitió bloque report.
function buildTextReport(answer: string, question: string): AgentReport {
    return {
        title: question.slice(0, 80),
        tables: [],
        charts: [],
        analysis: answer,   // el campo "analysis" es texto enriquecido del agente
    };
}

async function answerForProject(
    project: PhoneProject, question: string, fromPhone: string,
    requestId: string, startTime: number, justSelected: boolean, baseUrl: string
): Promise<Response> {
    await setActiveProject(fromPhone, project.IdProyecto);

    const { answer, report, executedSql, model } = await runAgent(project.IdProyecto, project.Proyecto, question);
    if (executedSql.length) console.log(`[${requestId}] project=${project.IdProyecto} SQL: ${executedSql.join(' | ').slice(0, 240)}`);

    const rawAnswer = answer || 'No pude generar una respuesta. ¿Puedes reformular tu pregunta?';
    const prefix    = justSelected ? `📍 ${project.Proyecto}\n` : '';

    // Truncar el texto de WhatsApp a ANSWER_CAP (100 chars) si hay reporte o si la
    // respuesta es larga — el detalle completo va en el link.
    const needsReport = rawAnswer.length > REPORT_THRESHOLD || (report && reportHasContent(report));
    const waText      = needsReport
        ? (prefix + rawAnswer.slice(0, ANSWER_CAP)).trim()
        : (prefix + rawAnswer).trim();

    let finalAnswer = waText;
    let reportUrl: string | null = null;

    if (needsReport) {
        // Usar el reporte emitido por el modelo, o construir uno con el texto completo
        const effectiveReport = (report && reportHasContent(report))
            ? report
            : buildTextReport(rawAnswer, question);

        try {
            const token = await saveShare({
                content: reportToMarkdown(effectiveReport),
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
            // Si falla el guardado, enviamos la respuesta completa sin link
            finalAnswer = (prefix + rawAnswer).trim();
        }
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
