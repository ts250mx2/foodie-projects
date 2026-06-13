import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getProjectConnection } from '@/lib/dynamic-db';
import { DATABASE_SCHEMA } from '@/lib/ai/schema';
import { buildProjectCatalog } from '@/lib/ai/catalog';
import { createSseStream, SSE_HEADERS } from '@/lib/ai/sse';

const MAX_TURNS = 12;

const ALLOWED_MODELS = new Set([
    'claude-opus-4-8',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
]);

async function executeQuery(connection: any, sql: string): Promise<any[]> {
    const trimmed = sql.toLowerCase().trim();
    if (!trimmed.startsWith('select') && !trimmed.startsWith('with')) {
        throw new Error('Solo se permiten consultas SELECT / WITH.');
    }
    const [rows] = await connection.execute(sql);
    return rows as any[];
}

// Ejecuta todos los query_database de un turno y devuelve los tool_result.
// Acumula el SQL ejecutado en `executedSql` (efecto colateral, compartido).
async function runToolBlocks(
    connection: any, content: any[], executedSql: string[]
): Promise<any[]> {
    const toolResults: any[] = [];
    for (const block of content) {
        if (block.type !== 'tool_use') continue;
        const sql = (block.input as any)?.sql || '';
        if (sql) executedSql.push(sql);
        try {
            const rows = await executeQuery(connection, sql);
            const resultStr = JSON.stringify(rows);
            toolResults.push({
                type:        'tool_result',
                tool_use_id: block.id,
                content:     resultStr.length > 12000 ? resultStr.slice(0, 12000) + '…]' : resultStr,
            });
        } catch (err: any) {
            toolResults.push({
                type:        'tool_result',
                tool_use_id: block.id,
                content:     JSON.stringify({ error: err.message }),
                is_error:    true,
            });
        }
    }
    return toolResults;
}

// El esquema de BD (estructura, igual para todos los proyectos) se importa de
// '@/lib/ai/schema'. El catálogo dinámico del proyecto (valores reales +
// convención de mes detectada en vivo) se arma con buildProjectCatalog().

// ─── Tools ────────────────────────────────────────────────────────────────────
export const AGENT_TOOLS: any[] = [
    {
        name: 'query_database',
        description: `Ejecuta SQL SELECT/WITH de solo lectura contra la BD MySQL del restaurante.
REGLAS OBLIGATORIAS:
- NUNCA uses tblVentas — tabla ignorada. Usa tblVentasCanalesVenta o tblVentasTerminales.
- Canales de venta (Rappi/Uber/etc): tblVentasCanalesVenta JOIN tblCanalesVenta
- Formas de pago/terminales: tblVentasTerminales JOIN tblTerminales
- Productos: SIEMPRE vlProductos, nunca tblProductos
- MySQL: LIMIT obligatorio. Nunca TOP.
- MES: NO es 1-12 en todas las tablas. Respeta la "CONVENCIÓN DE MES (detectada en vivo)"
  del catálogo del proyecto (ventas suelen ser 0-11; gastos/inventarios 1-12; nómina varía).
- Status=2 = anulado/eliminado: filtra "Status <> 2" en gastos, compras, etc.
- Usa los IDs reales del catálogo del proyecto (canales, terminales, turnos, sucursales).
Puedes encadenar múltiples llamadas para explorar antes de responder.`,
        input_schema: {
            type: 'object',
            properties: {
                sql: {
                    type: 'string',
                    description: 'SELECT o WITH. Un statement. Sin ; al final. Con LIMIT.',
                },
            },
            required: ['sql'],
        },
    },
    {
        name: 'ask_clarification',
        description: `Pregunta al usuario cuando falte información clave ANTES de consultar datos.
Úsala para aclarar: período (mes/año), sucursal específica, canal de venta, empleado, producto, proveedor o tipo de análisis.
CUÁNDO USARLA:
- El período no está claro y no es deducible del contexto → pregunta con opciones de períodos
- Hay varias interpretaciones razonables → propón la más probable y ofrece alternativas
- Necesitas un filtro específico que el usuario no mencionó y cambiaría el resultado
CUÁNDO NO USARLA:
- El contexto activo ya tiene mes/año/sucursal → úsalos directamente sin preguntar
- La petición es específica y clara → procede a query_database inmediatamente
- Ya preguntaste algo similar en esta conversación → no vuelvas a preguntar lo mismo`,
        input_schema: {
            type: 'object',
            properties: {
                question: {
                    type: 'string',
                    description: 'Pregunta clara y breve en español. Máx 120 caracteres.',
                },
                suggestions: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '2-5 opciones concretas y clicables (ej. "Este mes", "Mes pasado", "Enero 2025", "Todas las sucursales").',
                },
            },
            required: ['question', 'suggestions'],
        },
    },
];

// ─── System prompt ────────────────────────────────────────────────────────────
// Devuelve bloques de contenido. El primero (estable: rol + esquema + catálogo +
// reglas) lleva cache_control para que Anthropic lo cachee (5 min). El segundo
// (volátil: saludo + período + contexto) cambia por request y no se cachea.
export function buildSystemPrompt(context: any, projectCatalog: string): Anthropic.TextBlockParam[] {
    const now = new Date();
    const h   = now.getHours();
    const greeting = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';

    // Resolve month/year clearly for the agent
    // Always parse as numbers to avoid string/number comparison bugs
    const todayMonth  = Number(context?.todayMonth  ?? now.getMonth() + 1);
    const todayYear   = Number(context?.todayYear   ?? now.getFullYear());
    const dashMonth   = Number(context?.dashboardMonth ?? todayMonth);
    const dashYear    = Number(context?.dashboardYear  ?? todayYear);
    const branchId    = String(context?.branchId ?? '');

    const prevMonth = dashMonth === 1 ? 12 : dashMonth - 1;
    const prevYear  = dashMonth === 1 ? dashYear - 1 : dashYear;

    const monthNames = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    const prevTodayMonth = todayMonth === 1 ? 12 : todayMonth - 1;
    const prevTodayYear  = todayMonth === 1 ? todayYear - 1 : todayYear;

    // Los meses aquí son CALENDARIO (1-12). El agente DEBE convertirlos a la
    // convención de cada tabla usando el bloque "CONVENCIÓN DE MES" del catálogo.
    const periodBlock = `
PERÍODO Y CONTEXTO — LEE ESTO PRIMERO ANTES DE CUALQUIER CONSULTA:
  • HOY es ${now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${now.toISOString().split('T')[0]})
  • Mes REAL de hoy:               ${monthNames[todayMonth]} ${todayYear}  (mes calendario ${todayMonth})
  • Mes SELECCIONADO en dashboard: ${monthNames[Number(dashMonth)]} ${dashYear}  (mes calendario ${dashMonth})
  • Mes ANTERIOR al seleccionado:  ${monthNames[prevMonth]} ${prevYear}  (mes calendario ${prevMonth})
  • Sucursal activa (IdSucursal):  ${branchId || '(no seleccionada)'}

⚠️ Los números de mes de arriba son CALENDARIO (Enero=1 … Diciembre=12).
ANTES de escribir un WHERE, conviértelos a la convención de la tabla según el
bloque "CONVENCIÓN DE MES (detectada en vivo)" del catálogo del proyecto
(p. ej. en ventas 0-11 restas 1; en gastos 1-12 lo dejas igual).

CÓMO INTERPRETAR EL PERÍODO EN LAS PREGUNTAS (en meses calendario):
  - "este mes" / "mes actual" / "el mes" → ${monthNames[todayMonth]} ${todayYear} (calendario ${todayMonth})
  - "el mes del dashboard" / "el período seleccionado" → ${monthNames[Number(dashMonth)]} ${dashYear} (calendario ${dashMonth})
  - "mes pasado" / "mes anterior" → ${monthNames[prevTodayMonth]} ${prevTodayYear} (calendario ${prevTodayMonth})
  - "compara este mes vs el mes pasado" → compara ${monthNames[todayMonth]} ${todayYear} vs ${monthNames[prevTodayMonth]} ${prevTodayYear}
  - Si el período sigue siendo ambiguo, usa ask_clarification.
  - NUNCA asumas que el mes seleccionado en el dashboard = mes actual si ya conoces la fecha de hoy.
`;

    const ctxExtra = context
        ? `Sucursal activa: ${branchId || 'no seleccionada'} | Página: ${context.currentPage || ''}`
        : '';

    // ── Bloque ESTABLE (cacheable): rol + esquema + catálogo + cómo trabajas +
    //    estilo + benchmarks + reglas. No incluye fecha/hora ni saludo. ──────
    const stable = `Eres el AGENTE FOODIE GURU — consultor experto en rentabilidad y operaciones de restaurantes y negocios de alimentos. Combinas el conocimiento de un chef ejecutivo, un contador restaurantero y un consultor de negocios gastronómicos con 20 años de experiencia en México.

${DATABASE_SCHEMA}

${projectCatalog}

══════════════════════════════════════════
CÓMO TRABAJAS
══════════════════════════════════════════
1. PIENSA primero. ¿Tienes suficiente contexto (período, sucursal)?
   - Si el bloque CONTEXTO ya trae sucursal y período → ÚSALOS. No preguntes.
   - Si falta el período y no es deducible → usa ask_clarification con opciones.
   - Si es ambiguo pero hay una lectura clara → asume la más probable, avanza y dilo en una frase.

2. CONSULTA datos reales. Nunca inventes cifras. Usa query_database.
   - Explora si necesitas descubrir IDs/nombres (aunque el catálogo ya trae los principales).
   - Encadena queries: exploratorio → específico.
   - Si una query sale vacía, sospecha de la convención de mes y reintenta con el offset correcto antes de decir "no hay datos".

3. ANALIZA como experto. No solo reportas — interpretas, comparas vs benchmark/mes anterior, y señalas lo accionable.

══════════════════════════════════════════
MODO INVESTIGADOR — ANÁLISIS DE CAUSA RAÍZ
══════════════════════════════════════════
Cuando la pregunta sea DIAGNÓSTICA —"¿por qué bajaron/subieron las ventas?",
"¿qué pasó con la nómina?", "¿a qué se debe la caída/el alza?", "explica el
cambio", "¿qué está pasando con X?"— NO te quedes en el dato superficial.
Investiga como un consultor que busca la causa, no que solo reporta:

1) CUANTIFICA EL HECHO primero: ¿cuánto cambió y contra qué referencia?
   (mes vs mes anterior, o vs el mismo período del año pasado). Fija la magnitud.
2) DESCOMPÓN para localizar DÓNDE se concentra el cambio. Lanza VARIAS consultas
   —puedes pedir varias en el MISMO turno— cruzando las dimensiones relevantes
   hasta aislar la causa:
   • por sucursal · por turno · por canal de venta · por forma de pago
   • por día de la semana y por día del mes (¿fue puntual o sostenido?)
   • por producto/categoría (¿un SKU concreto o algo transversal?)
3) CONTRASTA HIPÓTESIS: descarta las dimensiones donde el cambio NO está y
   confirma dónde SÍ. La causa suele concentrarse en 1-2 dimensiones.
4) CONCLUYE liderando con la causa más probable y su peso (ej. "la caída de
   -12% se explica casi toda por el turno noche en San Jerónimo, -32%"), luego
   la evidencia que la sostiene, y cierra con UNA acción concreta.

REGLAS DEL INVESTIGADOR:
- NUNCA respondas una pregunta de causa con una sola query. Encadena/paraleliza
  hasta aislar el porqué.
- Si los datos NO permiten aislar la causa, dilo con honestidad y señala qué
  haría falta medir (ej. no hay venta a nivel producto).
- Una gráfica de la dimensión "culpable" (la que explica el cambio) ayuda mucho;
  inclúyela cuando aporte.

══════════════════════════════════════════
ESTILO DE RESPUESTA (clave para sonar como consultor, no como reporte)
══════════════════════════════════════════
REGISTRO: profesional pero humano, como un consultor senior que conoce el negocio.
Directo y cálido. Nunca robótico ni corporativo acartonado.

LONGITUD: CORTA por defecto — 2 a 4 oraciones para preguntas de datos simples.
Extiéndete solo si piden análisis profundo o una comparativa amplia.

FORMATO:
- Métricas INLINE en el texto, en **negritas**. No las escondas en listas.
  BIEN: "Vendiste **$182,400** en mayo, **8% arriba** de abril. El comedor jala
  el grueso (**$120K**); Uber ya pesa **$28K**, pero con 35% de comisión se te
  van **$9,800** en cargos."
  EVITA: "• Total: $X  • Comedor: $Y" para datos básicos.
- Usa tablas Markdown SOLO cuando compares varias filas/períodos (top productos,
  mes vs mes, sucursal vs sucursal). La UI las renderiza bien.
- NO uses encabezados rígidos tipo "📊 Datos / 💡 Hallazgos / ✅ Sugerencias".
  Teje el hallazgo y la recomendación dentro de la prosa.

NO HAGAS:
✗ No repitas la pregunta al inicio.
✗ No digas "voy a consultar..." ni "permíteme..." — actúa y responde directo.
✗ No cierres siempre con "¿quieres profundizar?". Ofrece un siguiente paso solo
  si de verdad aporta, en una frase natural.

SÍ HAZ:
✓ Respuesta directa, prosa fluida, cifras clave en **negritas**.
✓ Si ves algo anómalo o una oportunidad (comisión delivery alta, food cost
  elevado, producto bajo mínimo, caída fuerte), menciónalo en una frase con el dato.
✓ Para preguntas NO de datos (saludo, concepto, opinión), responde como Claude
  normal, conversacional, sin ejecutar herramientas.

══════════════════════════════════════════
GRÁFICAS (opcional, cuando ayudan a ver los datos)
══════════════════════════════════════════
Cuando una gráfica ayude a entender datos comparativos —varias categorías,
evolución en el tiempo o distribución/participación— incluye UN bloque de
gráfica ADEMÁS de tu texto. Usa este formato EXACTO (bloque cercado \`\`\`chart
con un JSON en una sola línea):

\`\`\`chart
{"type":"bar","title":"Ventas por canal (mayo 2026)","format":"currency","data":[{"name":"Comedor","value":1382567},{"name":"Uber","value":111322},{"name":"Rappi","value":61777}]}
\`\`\`

REGLAS DE LA GRÁFICA:
- "type": "bar" (comparar categorías), "line" (evolución temporal), "pie" (distribución/% participación).
- "format": "currency" (MXN), "number" o "percent".
- Para comparar DOS series (ej. mayo vs abril) agrega "value2" a cada punto y "seriesLabels":["Mayo","Abril"].
- Máximo ~12 puntos. Nombres cortos. Los valores son números crudos (sin $, sin comas, sin %).
- Pon la gráfica DESPUÉS de tu texto de análisis — nunca en lugar del texto.
- NO la uses para un solo dato ni para preguntas conceptuales.
- No anuncies "aquí está la gráfica"; simplemente inclúyela al final.

══════════════════════════════════════════
PANTALLAS DEL DASHBOARD (guiar al usuario)
══════════════════════════════════════════
Cuando al usuario le sirva ABRIR una pantalla del sistema —para ver el detalle,
profundizar o capturar/corregir datos— incluye al FINAL un bloque \`\`\`nav con 1 a
3 destinos. Formato EXACTO (JSON en una sola línea):

\`\`\`nav
{"items":[{"label":"Ver ventas por canal","path":"/dashboard/sales/channels","reason":"desglose y comisiones"}]}
\`\`\`

PANTALLAS DISPONIBLES (usa EXACTAMENTE estos paths, sin prefijo de idioma):
- /dashboard — Resumen general (ventas, gastos, nómina, utilidad estimada)
- /dashboard/sales — Ventas (resumen)
- /dashboard/sales/channels — Ventas por canal (comedor, delivery) y comisiones
- /dashboard/sales/terminals — Ventas por forma de pago / terminal
- /dashboard/expenses — Gastos operativos
- /dashboard/purchases — Compras de insumos
- /dashboard/purchases/suppliers — Proveedores
- /dashboard/inventories — Inventario
- /dashboard/inventories/min-max — Productos vs máximos/mínimos (bajo mínimo)
- /dashboard/payroll — Nómina
- /dashboard/production — Producción
- /dashboard/production/dishes — Platillos y costeo (alertas de costo)
- /dashboard/config/break-even — Punto de equilibrio

REGLAS DE NAVEGACIÓN:
- Úsalo SOLO cuando navegar aporte de verdad (no en cada respuesta).
- Máximo 3 destinos; "path" debe ser uno EXACTO de la lista.
- Ponlo al final, sin anunciarlo. Puede ir junto con una gráfica.

══════════════════════════════════════════
BENCHMARKS DE LA INDUSTRIA RESTAURANTERA MEXICANA
══════════════════════════════════════════
- Food cost (compras/ventas):    ideal 28-35%  |  >38% = alerta roja
- Labor cost (nómina/ventas):    ideal 25-32%  |  >35% = alerta
- Prime cost (food+labor):       ideal <60%    |  >65% = zona de pérdida
- Gastos operativos:             ideal 10-15%
- Utilidad operativa:            saludable 15-25%
- Comisión delivery Rappi/Uber:  25-35% del pedido — impacto CRÍTICO en márgenes
- Ticket promedio QSR:           $120-$180 MXN  |  Casual dining: $250-$450 MXN
- Merma aceptable:               <3% del inventario

REGLAS ADICIONALES:
- Responde SIEMPRE en español.
- Formatea montos como moneda MXN ($12,345.00).
- NUNCA expongas nombres técnicos de tablas/columnas al usuario.
- NUNCA digas "no tengo acceso a datos" sin antes intentar al menos una query.
- Si hay sucursal activa (ver CONTEXTO abajo), filtra SIEMPRE por su IdSucursal.
- MES: convierte SIEMPRE el mes calendario a la convención de cada tabla (ver
  "CONVENCIÓN DE MES" del catálogo). Es el error #1 — verifícalo antes de filtrar.
- Si ves comisiones de delivery altas (>25%), menciona el impacto en rentabilidad.
- Al comparar meses, SIEMPRE menciona los nombres (ej. "Mayo vs Abril").`;

    // ── Bloque VOLÁTIL (no cacheable): fecha/hora, saludo, período, contexto ──
    const volatile = `${greeting}.

${periodBlock}

CONTEXTO ACTIVO: ${ctxExtra || '(sin contexto adicional)'}`;

    return [
        { type: 'text', text: stable, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: volatile },
    ];
}

// ─── Fallback de modelo ─────────────────────────────────────────────────────
// Si el modelo elegido falla por sobrecarga/crédito/rate-limit, degradamos al
// siguiente de la cadena en vez de romper la conversación.
const MODEL_FALLBACKS: Record<string, string[]> = {
    'claude-opus-4-8':           ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    'claude-sonnet-4-6':         ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    'claude-haiku-4-5-20251001': ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'],
};

function shouldFallback(err: any): boolean {
    const status = err?.status;
    const msg = String(err?.message || '').toLowerCase();
    if ([429, 500, 502, 503, 529].includes(status)) return true;
    return ['overloaded', 'credit', 'rate limit', 'billing'].some(s => msg.includes(s));
}

async function createMessageWithFallback(
    anthropic: Anthropic,
    params: Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'>,
    primaryModel: string,
): Promise<{ response: Anthropic.Message; modelUsed: string }> {
    const chain = MODEL_FALLBACKS[primaryModel] || [primaryModel];
    let lastErr: any;
    for (let i = 0; i < chain.length; i++) {
        try {
            const response = await anthropic.messages.create({ ...params, model: chain[i] });
            return { response, modelUsed: chain[i] };
        } catch (err) {
            lastErr = err;
            if (i < chain.length - 1 && shouldFallback(err)) {
                console.warn(`[ai/chat] modelo ${chain[i]} falló (${(err as any)?.status ?? ''}); probando ${chain[i + 1]}`);
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
    let connection: any = null;
    try {
        const { messages, model, context, projectId } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'messages requerido' }, { status: 400 });
        }

        if (!projectId) {
            return NextResponse.json({
                content: 'No se detectó un proyecto activo. Por favor inicia sesión con tu proyecto para que pueda consultar tus datos.',
                modelUsed: 'none',
            });
        }

        const resolvedModel = ALLOWED_MODELS.has(model) ? model : 'claude-sonnet-4-6';
        const anthropic     = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        connection = await getProjectConnection(projectId);

        // Catálogo dinámico del proyecto: dimensiones reales + convención de mes
        // detectada en vivo. Si falla, seguimos con el esquema estático.
        let projectCatalog = '';
        try {
            projectCatalog = await buildProjectCatalog(connection, String(projectId));
        } catch (e) {
            console.error('No se pudo construir el catálogo del proyecto:', e);
        }

        const systemPrompt = buildSystemPrompt(context || {}, projectCatalog);
        const executedSql: string[] = [];

        const conversationMessages: { role: 'user' | 'assistant'; content: any }[] = messages.map((m: any) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
        }));

        // ── BRANCH STREAMING (SSE) ────────────────────────────────────────────
        const useStreaming = new URL(req.url).searchParams.get('stream') === 'true';
        if (useStreaming) {
            const ownedConn = connection;
            connection = null; // el stream cierra la conexión; evita doble-cierre en finally
            const stream = createSseStream(async (emit) => {
                try {
                    let turns       = 0;
                    let finalText   = '';
                    let activeModel = resolvedModel;
                    emit({ type: 'status', phase: 'thinking' });

                    while (turns < MAX_TURNS) {
                        turns++;
                        const msgStream = anthropic.messages.stream({
                            model:       activeModel,
                            max_tokens:  8192,
                            system:      systemPrompt,
                            tools:       AGENT_TOOLS,
                            tool_choice: { type: 'auto' },
                            messages:    conversationMessages,
                        });

                        let turnText  = '';
                        let sawTool   = false;
                        let resetSent = false;
                        for await (const ev of msgStream) {
                            if (ev.type === 'content_block_start' && (ev as any).content_block?.type === 'tool_use') {
                                sawTool = true;
                                // Si el modelo emitió preámbulo antes de la tool, bórralo en el cliente.
                                if (turnText && !resetSent) { emit({ type: 'reset' }); resetSent = true; turnText = ''; }
                            } else if (ev.type === 'content_block_delta' && (ev as any).delta?.type === 'text_delta') {
                                if (!sawTool) {
                                    const t = (ev as any).delta.text as string;
                                    turnText += t;
                                    emit({ type: 'text', delta: t });
                                }
                            }
                        }

                        const finalMessage = await msgStream.finalMessage();

                        // Turno final (sin tools): el texto ya se transmitió.
                        if (finalMessage.stop_reason !== 'tool_use') {
                            const tb = finalMessage.content.find((c: any) => c.type === 'text') as any;
                            finalText = turnText || tb?.text || '';
                            break;
                        }

                        // ask_clarification → evento terminal
                        const clar = finalMessage.content.find(
                            (c: any) => c.type === 'tool_use' && c.name === 'ask_clarification'
                        ) as any;
                        if (clar) {
                            emit({
                                type: 'clarification',
                                question:    clar.input?.question || '¿Qué período te gustaría analizar?',
                                suggestions: clar.input?.suggestions || [],
                            });
                            emit({ type: 'done', modelUsed: activeModel, executedSql: executedSql.join(';\n') });
                            return;
                        }

                        // query_database → ejecuta y realimenta
                        emit({ type: 'status', phase: 'querying' });
                        conversationMessages.push({ role: 'assistant', content: finalMessage.content });
                        const toolResults = await runToolBlocks(ownedConn, finalMessage.content, executedSql);
                        conversationMessages.push({ role: 'user', content: toolResults });
                        emit({ type: 'status', phase: 'analyzing' });
                    }

                    emit({ type: 'done', content: finalText, modelUsed: activeModel, executedSql: executedSql.join(';\n') });
                } finally {
                    try { await ownedConn.end(); } catch { /* noop */ }
                }
            });
            return new Response(stream, { headers: SSE_HEADERS });
        }

        // ── BRANCH NO-STREAMING (JSON, back-compat) ───────────────────────────
        let turns       = 0;
        let finalText   = '';
        let activeModel = resolvedModel;

        while (turns < MAX_TURNS) {
            turns++;

            const { response: resp, modelUsed } = await createMessageWithFallback(anthropic, {
                max_tokens: 8192,
                system:     systemPrompt,
                tools:      AGENT_TOOLS,
                tool_choice: { type: 'auto' },
                messages:   conversationMessages,
            }, activeModel);
            activeModel = modelUsed; // si degradó, sigue con ese modelo el resto del loop

            // Collect text from this turn
            const textBlock = resp.content.find((c: any) => c.type === 'text');
            if (textBlock?.type === 'text') finalText = textBlock.text;

            // No more tool calls → done
            if (resp.stop_reason !== 'tool_use') break;

            // Check for ask_clarification in this turn's tool calls
            const clarificationBlock = resp.content.find(
                (c: any) => c.type === 'tool_use' && c.name === 'ask_clarification'
            );
            if (clarificationBlock?.type === 'tool_use') {
                const input = clarificationBlock.input as any;
                return NextResponse.json({
                    clarification: {
                        question:    input.question    || '¿Qué período te gustaría analizar?',
                        suggestions: input.suggestions || [],
                    },
                    modelUsed: activeModel,
                    executedSql: executedSql.join(';\n'),
                });
            }

            // Process all query_database tool calls
            conversationMessages.push({ role: 'assistant', content: resp.content });
            const toolResults = await runToolBlocks(connection, resp.content, executedSql);
            conversationMessages.push({ role: 'user', content: toolResults });
        }

        return NextResponse.json({
            content:    finalText,
            modelUsed:  activeModel,
            executedSql: executedSql.join(';\n'),
        });

    } catch (error: any) {
        console.error('AI Chat Error:', error);
        return NextResponse.json({ error: 'Error en la IA', details: error.message }, { status: 500 });
    } finally {
        if (connection) {
            try { await connection.end(); } catch { }
        }
    }
}
