import { NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { DATABASE_SCHEMA } from '@/lib/ai/schema';
import { buildProjectCatalog } from '@/lib/ai/catalog';
import { createReport, AdvancedReportDefinition, ReportViz, resolveReportSql, sanitizeParams } from '@/lib/ai/reports-store';
import { createSseStream, SSE_HEADERS } from '@/lib/ai/sse';
import { completarTexto, correrTurnoAgente, credencialParaRuta, type CredencialIA } from '@/lib/ai/agente-modelo';

const MAX_TURNS = 8;
// Proveedor y modelo los fija HL Console (agente HL_AGENTE_FOODIE): esta ruta
// ya no los elige ni los recibe del cliente, y el reintento por fallo del
// proveedor lo cubre el agente de respaldo dentro de correrTurnoAgente.

function assertSelect(sql: string): string {
    const t = sql.toLowerCase().trim();
    if (!t.startsWith('select') && !t.startsWith('with')) throw new Error('El SQL del reporte debe ser SELECT/WITH.');
    if (/;\s*\S/.test(sql)) throw new Error('Un solo statement, sin ";".');
    return sql.replace(/;\s*$/, '');
}
async function runQuery(conn: any, sql: string): Promise<any[]> {
    const [rows] = await conn.execute(sql);
    return rows as any[];
}
const normViz = (v: any): ReportViz => (['table', 'bar', 'line', 'pie', 'kpi'].includes(v) ? v : 'table');

// Para EXPLORAR: si el agente prueba SQL con tokens {{month}}/{{year}}, resuélvelos con el
// período ACTUAL para que la consulta corra (los tokens reales van solo en el save_report final).
function resolveProbeTokens(sql: string): string {
    if (!/\{\{/.test(sql)) return sql;
    return resolveReportSql({ sql, parameters: [
        { key: 'month', label: 'Mes', type: 'month' },
        { key: 'year', label: 'Año', type: 'year' },
    ] }, {});
}

// Etiqueta amigable de una consulta (área de negocio) SIN exponer el SQL.
function describeQuery(sql: string): string {
    const s = (sql || '').toLowerCase();
    const map: [RegExp, string][] = [
        [/tblventascanalesventa|tblcanalesventa/, 'ventas por canal'],
        [/tblventasterminales|tblterminales/, 'ventas por forma de pago'],
        [/tblventasdia|tblventas\b/, 'ventas'],
        [/tblgastos|tblconceptosgastos|tbldetallegastos/, 'gastos'],
        [/tblcompras|tbldetallecompras|tblproveedores/, 'compras'],
        [/tblinventarios|tblmermas|tblsucursalesmaximosminimos/, 'inventario'],
        [/tblnomina/, 'nómina'],
        [/tblpropinas/, 'propinas'],
        [/vlplatillos/, 'platillos'],
        [/vlproductos|tblproductos|tblproductoskits/, 'productos'],
        [/tblproduccion/, 'producción'],
        [/tblsucursalescostos/, 'metas y costos'],
        [/tblturnos/, 'turnos'],
        [/tblempleados|tblpuestos/, 'empleados'],
        [/tblsucursales/, 'sucursales'],
    ];
    for (const [re, label] of map) if (re.test(s)) return label;
    return '';
}

const TOOLS: any[] = [
    {
        name: 'query_database',
        description: `Ejecuta SQL SELECT/WITH de solo lectura para EXPLORAR la BD del restaurante antes de diseñar el reporte (descubrir columnas, IDs, valores, validar que tu SQL regrese filas). Respeta la convención de mes del catálogo. LIMIT obligatorio.`,
        input_schema: { type: 'object', properties: { sql: { type: 'string' } }, required: ['sql'] },
    },
    {
        name: 'save_report',
        description: `Guarda el reporte ya diseñado. Llámala UNA vez cuando tengas el SQL final validado (que ya probaste con query_database y regresa filas).`,
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Título corto del reporte' },
                description: { type: 'string', description: 'Una línea de qué muestra' },
                sql: { type: 'string', description: 'SELECT/WITH final, un statement, con LIMIT. Primera columna = dimensión (etiqueta); luego columnas numéricas (medidas).' },
                visualization: { type: 'string', enum: ['table', 'bar', 'line', 'pie', 'kpi'], description: 'bar=comparar categorías, line=evolución temporal, pie=distribución, table=lista/varias columnas, kpi=indicadores (UNA fila con varias medidas como tarjetas)' },
                columns: {
                    type: 'array',
                    description: 'Columnas del SELECT EN ORDEN',
                    items: {
                        type: 'object',
                        properties: {
                            key: { type: 'string', description: 'alias exacto de la columna' },
                            role: { type: 'string', enum: ['dimension', 'measure', 'temporal'] },
                            format: { type: 'string', enum: ['currency', 'number', 'percent', 'date', 'text'] },
                        },
                        required: ['key', 'role'],
                    },
                },
                parameters: {
                    type: 'array',
                    description: 'Parámetros de período para que el reporte sea reutilizable. Declara aquí CADA token {{...}} que usaste en el SQL (típicamente {{month}} y {{year}}). Omite si el reporte no depende de un período.',
                    items: {
                        type: 'object',
                        properties: {
                            key: { type: 'string', description: 'nombre del token SIN llaves, ej. "month" o "year"' },
                            label: { type: 'string', description: 'etiqueta para el usuario, ej. "Mes"' },
                            type: { type: 'string', enum: ['month', 'year'] },
                            default: { type: 'number', description: 'valor por defecto: mes calendario 1-12, o año (ej. 2026)' },
                        },
                        required: ['key', 'type'],
                    },
                },
            },
            required: ['title', 'sql', 'visualization', 'columns'],
        },
    },
];

function buildBuilderPrompt(catalog: string): string {
    return `Eres el AGENTE CONSTRUCTOR DE REPORTES de Foodie Guru. Tu trabajo: a partir de la
petición del usuario, DISEÑAR UN reporte guardable para un restaurante (dueño no técnico).

PROCESO:
1. Explora con query_database lo necesario para escribir un SQL correcto (descubre IDs/nombres,
   valida la convención de mes del catálogo, confirma que tu consulta regrese filas).
2. Diseña UN SQL SELECT/WITH de solo lectura, con LIMIT, cuya PRIMERA columna sea la dimensión
   (etiqueta legible, ej. nombre de canal/concepto/producto) y las siguientes sean medidas
   numéricas. Usa alias claros en español.
3. Elige la visualización: bar (comparar categorías), line (evolución por día/mes), pie
   (distribución/participación), table (lista con varias columnas), kpi (indicadores clave).
4. Llama save_report con el SQL final ya validado y las columnas en orden.

KPI (indicadores): úsalo cuando el usuario pida "indicadores", "KPIs", "resumen", "tablero" o
"totales del mes". El SQL debe regresar UNA SOLA FILA con varias columnas numéricas (cada una es
una tarjeta), con alias claros y format adecuado (ej. ventas/gastos/utilidad como currency,
ticket promedio currency, # transacciones number, margen percent). No lleva dimensión. Combina
áreas con subconsultas/CTEs si hace falta (ej. ventas del período y gastos del período en la
misma fila). Respeta la convención de mes de CADA tabla por separado.

REGLAS:
- NUNCA modifiques datos. Solo SELECT/WITH.
- Respeta SIEMPRE la convención de mes por tabla del catálogo (es el error #1).
- Formatea montos como medidas con format "currency". Pon LIMIT razonable (≤ 50).
- No expongas nombres de tablas al usuario en title/description.

PARAMETRIZACIÓN (¡clave para que el reporte sirva CADA mes, no solo hoy!):
- Si la petición implica un PERÍODO ("del mes", "este mes", "mes pasado", un mes concreto,
  "del año"), NO fijes el mes/año en el SQL: usa los TOKENS {{month}} y {{year}} y decláralos
  en "parameters" (type "month"/"year") con "default" = el período que pidió el usuario (o el
  actual). Así el dueño podrá cambiar mes/año al abrir el reporte.
- {{month}} SIEMPRE vale el mes CALENDARIO 1-12. Como la convención de mes varía por tabla,
  escribe el AJUSTE dentro del SQL alrededor del token:
    · tablas de VENTAS (mes 0-11):        usa  Mes = {{month}} - 1
    · GASTOS/COMPRAS/INVENTARIO (mes 1-12): usa  Mes = {{month}}
    · NÓMINA: aplica la convención que confirmes en el catálogo.
  {{year}} es el año tal cual en todas las tablas.
- Para EXPLORAR con query_database usa números concretos (no tokens). Los tokens van ÚNICAMENTE
  en el SQL final de save_report, y debes declararlos todos en "parameters".
- Si NO hay período (ej. catálogo de proveedores, lista de sucursales), no agregues parámetros.

${DATABASE_SCHEMA}

${catalog}`;
}

type Emit = (e: Record<string, any> & { type: string }) => void;

// Núcleo del constructor. Emite eventos amigables (sin SQL) si se pasa `emit`.
async function buildReport(
    connection: any, projectId: number, prompt: string, credencial: CredencialIA, emit?: Emit
): Promise<{ idReporte: number; url: string; title: string; description?: string; visualization: ReportViz; rows: number }> {
    emit?.({ type: 'status', label: 'Entendiendo tu petición…' });
    let catalog = '';
    try { catalog = await buildProjectCatalog(connection, String(projectId)); }
    catch (e) { console.error('catálogo falló:', e); }

    const system = buildBuilderPrompt(catalog);
    const messages: { role: 'user' | 'assistant'; content: any }[] = [{ role: 'user', content: String(prompt) }];

    let saved: any = null;
    let turns = 0;
    let queryCount = 0;

    emit?.({ type: 'status', label: 'Diseñando el reporte…' });

    while (turns < MAX_TURNS && !saved) {
        turns++;
        const turno = await correrTurnoAgente({
            ...credencial,
            sistema: system, herramientas: TOOLS, mensajes: messages,
            maxTokens: 4096, alTexto: () => {},
        });

        if (!turno.pidioHerramientas) {
            const txt = (turno.contenido.find((c: any) => c.type === 'text') as any)?.text || '';
            throw Object.assign(new Error('El agente no pudo construir el reporte.'), { detail: txt.slice(0, 500), status: 422 });
        }

        messages.push({ role: 'assistant', content: turno.contenido });
        const results: any[] = [];
        for (const block of turno.contenido) {
            if (block.type !== 'tool_use') continue;
            if (block.name === 'save_report') { saved = block.input; results.push({ type: 'tool_result', tool_use_id: block.id, content: 'OK' }); continue; }
            // query_database
            const sql = String((block.input as any)?.sql || '').replace(/```sql|```/g, '').trim();
            try {
                const lower = sql.toLowerCase().trim();
                if (!lower.startsWith('select') && !lower.startsWith('with')) throw new Error('Solo SELECT/WITH.');
                const rows = await runQuery(connection, resolveProbeTokens(sql));
                queryCount++;
                const area = describeQuery(sql);
                emit?.({ type: 'step', label: 'Consulta construida', area, rows: rows.length });
                const s = JSON.stringify(rows);
                results.push({ type: 'tool_result', tool_use_id: block.id, content: s.length > 12000 ? s.slice(0, 12000) + '…]' : s });
            } catch (err: any) {
                results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ error: err.message }), is_error: true });
            }
        }
        if (!saved) messages.push({ role: 'user', content: results });
    }

    if (!saved) throw Object.assign(new Error('El agente no logró diseñar el reporte (demasiados pasos).'), { status: 422 });

    emit?.({ type: 'status', label: 'Validando y ejecutando la consulta…' });
    const parameters = sanitizeParams(saved.parameters);
    const finalSql = assertSelect(String(saved.sql || ''));
    // Para validar/ejecutar usa los tokens resueltos con sus valores por defecto.
    const probeSql = resolveReportSql({ sql: finalSql, parameters }, {});
    const rows = await runQuery(connection, probeSql);
    const sample = rows.slice(0, 50);

    emit?.({ type: 'status', label: 'Generando hallazgos…' });
    let insights: string[] = [];
    if (sample.length > 0) {
        try {
            const ip = `Eres consultor restaurantero. Da 2-3 hallazgos accionables (en español, con **negritas** en cifras) sobre estos datos del reporte "${saved.title}". Responde SOLO JSON: {"insights":["..."]}\nDATOS (${rows.length} filas, muestra): ${JSON.stringify(sample).slice(0, 7000)}`;
            const { texto: t } = await completarTexto(credencial, {
                maxTokens: 700, mensajes: [{ role: 'user', content: ip }],
            });
            const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
            if (Array.isArray(j.insights)) insights = j.insights.slice(0, 4).map((s: any) => String(s));
        } catch { /* insights opcionales */ }
    }

    emit?.({ type: 'status', label: 'Guardando reporte…' });
    const definition: AdvancedReportDefinition = {
        title: String(saved.title || 'Reporte').slice(0, 300),
        description: saved.description ? String(saved.description).slice(0, 1000) : undefined,
        sql: finalSql,
        visualization: normViz(saved.visualization),
        expectedColumns: Array.isArray(saved.columns) ? saved.columns : [],
        insights,
        parameters: parameters.length ? parameters : undefined,
        createdWith: { model: credencial.modelo, createdAt: new Date().toISOString() },
    };
    const idReporte = await createReport(connection, definition, credencial.modelo);

    return {
        idReporte, url: `/dashboard/reportes/${idReporte}`,
        title: definition.title, description: definition.description,
        visualization: definition.visualization, rows: rows.length,
    };
}

export async function POST(req: Request) {
    let connection: any = null;
    try {
        const { projectId, prompt } = await req.json();
        if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });
        if (!prompt || !String(prompt).trim()) return NextResponse.json({ error: 'prompt requerido' }, { status: 400 });

        const credencialHl = await credencialParaRuta('foodie');
        if (!credencialHl.ok) return NextResponse.json({ error: credencialHl.error }, { status: 503 });
        const credencial = credencialHl.credencial;

        connection = await getProjectConnection(projectId);

        const useStream = new URL(req.url).searchParams.get('stream') === 'true';
        if (useStream) {
            const ownedConn = connection;
            connection = null;
            const stream = createSseStream(async (emit) => {
                try {
                    const result = await buildReport(ownedConn, projectId, String(prompt), credencial, emit);
                    emit({ type: 'done', ...result });
                } catch (e: any) {
                    emit({ type: 'error', message: e?.message || 'Error creando el reporte', detail: e?.detail });
                } finally {
                    try { await ownedConn.end(); } catch { /* noop */ }
                }
            });
            return new Response(stream, { headers: SSE_HEADERS });
        }

        const result = await buildReport(connection, projectId, String(prompt), credencial);
        return NextResponse.json(result);
    } catch (e: any) {
        console.error('reports/build error:', e);
        return NextResponse.json({ error: e?.message || 'Error creando el reporte', detail: e?.detail }, { status: e?.status || 500 });
    } finally {
        if (connection) { try { await connection.end(); } catch { /* noop */ } }
    }
}
