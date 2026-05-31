import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getProjectConnection } from '@/lib/dynamic-db';

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

// ─── Schema completo ───────────────────────────────────────────────────────────
const DATABASE_SCHEMA = `
VENTAS — REGLA CRÍTICA: nunca uses tblVentas, esa tabla está ignorada.
  • Ventas por CANAL DE VENTA (Rappi, Uber Eats, DiDi Food, local, etc.)
      → tblVentasCanalesVenta v JOIN tblCanalesVenta c ON v.IdCanalVenta = c.IdCanalVenta
        Columnas: v.Dia, v.Mes, v.Anio, v.IdTurno, v.IdSucursal, v.Venta, c.CanalVenta, c.Comision
  • Ventas por FORMA DE PAGO / TERMINAL (efectivo, tarjeta débito, tarjeta crédito, etc.)
      → tblVentasTerminales v JOIN tblTerminales t ON v.IdTerminal = t.IdTerminal
        Columnas: v.Dia, v.Mes, v.Anio, v.IdTurno, v.IdSucursal, v.Venta, t.Terminal, t.Comision
  • Para TOTAL de ventas: suma ambas tablas y usa el mayor valor
    (el negocio puede registrar en canales, terminales, o ambos)

GASTOS:
  tblGastos: IdGasto, IdProveedor(-2=canal venta,-1=sin proveedor), FechaGasto, Dia, Mes, Anio,
             IdConceptoGasto, Total, FechaAct, IdSucursal, ConceptoGasto, Status(0=activo), NumeroFactura
  tblDetalleGastos: IdDetalleGasto, IdGasto, Concepto, Cantidad, Costo, Status, FechaAct
  tblConceptosGastos: IdConceptoGasto, ConceptoGasto, Status

COMPRAS:
  tblCompras: IdCompra, ConceptoCompra, FechaCompra, IdProveedor, NumeroFactura, Status(0=activo),
              Subtotal, Iva, Total, IdFormaPago, FormaPago, IdSucursal
  tblDetalleCompras: IdDetalleCompra, IdCompra, IdProducto, Producto, Cantidad, Precio, Iva, Total, Codigo

INVENTARIO:
  tblInventarios: IdProducto, Dia, Mes, Anio, FechaInventario, Cantidad, Precio, FechaAct, Consumo
  tblConfiguracionesMeses: Mes, Anio, ProyeccionVentas, IdSucursal

PRODUCTOS — SIEMPRE usa vlProductos, nunca tblProductos directamente:
  vlProductos: IdProducto, Producto, IdCategoria, Categoria, IdPresentacion, Presentacion, Precio
  tblProductosKits: IdProductoPadre, IdProductoHijo, Cantidad (recetas/sub-recetas)

NÓMINA Y PROPINAS:
  tblNomina: IdNomina, Dia, Mes, Anio, IdUsuario(=IdEmpleado), Pago, FechaAct, IdSucursal
  tblPropinasEmpleados: IdPropinaEmpleado, IdEmpleado, IdSucursal, IdTurno, Dia, Mes, Anio,
                        IdPerfilPropina, Venta, Porcentaje, Monto, MontoPropina
  tblPerfilesPropinas: IdPerfilPropina, PerfilPropina, EsActivo, Status

EMPLEADOS Y TURNOS:
  tblEmpleados: IdEmpleado, Empleado, IdPuesto, IdSucursal, Status(0=activo)
  tblPuestos: IdPuesto, Puesto, Status
  tblTurnos: IdTurno, Turno, HoraInicio, HoraFin, Status, IdSucursal
  tblSucursalesEmpleados: IdSucursal, IdEmpleado

SUCURSALES Y COSTOS:
  tblSucursales: IdSucursal, Sucursal, Status
  tblSucursalesCostos: IdSucursal, Mes, Anio, ObjetivoVentas, CostoMateriaPrima, CostoNomina
  tblProveedores: IdProveedor, Proveedor, RFC, Status
  tblCategorias: IdCategoria, Categoria, Status

RELACIONES CLAVE:
  tblVentasCanalesVenta.IdCanalVenta  → tblCanalesVenta  (CanalVenta, Comision %)
  tblVentasTerminales.IdTerminal      → tblTerminales    (Terminal, Comision %)
  tblNomina.IdUsuario                 = tblEmpleados.IdEmpleado
  tblGastos con IdProveedor=-2        → gasto de comisión/impuesto generado por canal de venta
  tblCompras.IdProveedor              → tblProveedores
`;

// ─── Tools ────────────────────────────────────────────────────────────────────
const AGENT_TOOLS: any[] = [
    {
        name: 'query_database',
        description: `Ejecuta SQL SELECT/WITH de solo lectura contra la BD MySQL del restaurante.
REGLAS OBLIGATORIAS:
- NUNCA uses tblVentas — tabla ignorada. Usa tblVentasCanalesVenta o tblVentasTerminales.
- Canales de venta (Rappi/Uber/etc): tblVentasCanalesVenta JOIN tblCanalesVenta
- Formas de pago/terminales: tblVentasTerminales JOIN tblTerminales
- Productos: SIEMPRE vlProductos, nunca tblProductos
- MySQL: LIMIT obligatorio. Nunca TOP.
- Meses en BD: 1-12. El contexto JS puede traer 0-11, suma +1.
- Status=0 = activo/vigente en gastos, compras, empleados.
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
function buildSystemPrompt(context: any): string {
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

    const periodBlock = `
PERÍODO Y CONTEXTO — LEE ESTO PRIMERO ANTES DE CUALQUIER CONSULTA:
  • HOY es ${now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${now.toISOString().split('T')[0]})
  • Mes REAL de hoy:         ${monthNames[todayMonth]} ${todayYear}  (Mes=${todayMonth} en BD)
  • Mes SELECCIONADO en dashboard: ${monthNames[Number(dashMonth)]} ${dashYear}  (Mes=${dashMonth} en BD)
  • Mes ANTERIOR al seleccionado:  ${monthNames[prevMonth]} ${prevYear}  (Mes=${prevMonth} en BD)
  • Sucursal activa (IdSucursal):  ${branchId || '(no seleccionada)'}

CÓMO INTERPRETAR EL PERÍODO EN LAS PREGUNTAS:
  - "este mes" / "mes actual" / "el mes" → usa Mes=${todayMonth} AND Anio=${todayYear} (hoy real)
  - "el mes del dashboard" / "el período seleccionado" → usa Mes=${dashMonth} AND Anio=${dashYear}
  - "mes pasado" / "mes anterior" → mes anterior al MES REAL DE HOY = Mes=${todayMonth === 1 ? 12 : todayMonth - 1} AND Anio=${todayMonth === 1 ? todayYear - 1 : todayYear}
  - Si el usuario dice "compara este mes vs el mes pasado" → compara ${monthNames[todayMonth]} ${todayYear} vs ${monthNames[todayMonth === 1 ? 12 : todayMonth - 1]} ${todayMonth === 1 ? todayYear - 1 : todayYear}
  - Si el período sigue siendo ambiguo, usa ask_clarification.
  - NUNCA asumas que el mes seleccionado en el dashboard = mes actual si ya conoces la fecha de hoy.
`;

    const ctxExtra = context
        ? `Sucursal activa: ${branchId || 'no seleccionada'} | Página: ${context.currentPage || ''}`
        : '';

    return `Eres el AGENTE FOODIE GURU — consultor experto en rentabilidad y operaciones de restaurantes y negocios de alimentos. Combinas el conocimiento de un chef ejecutivo, un contador restaurantero y un consultor de negocios gastronómicos con 20 años de experiencia en México.

${greeting}.

${periodBlock}
${ctxExtra}

${DATABASE_SCHEMA}

══════════════════════════════════════════
CÓMO TRABAJAS — AGENTE AGENTICO POTENTE
══════════════════════════════════════════
1. PIENSA primero. ¿Tienes suficiente contexto para responder (período, sucursal)?
   - Si el contexto activo tiene branchId, month, year → ÚSALOS directamente. No preguntes.
   - Si no hay contexto de período → usa ask_clarification con opciones de período.
   - Si la pregunta es ambigua → propón la interpretación más probable, avanza y menciona tu asunción.

2. CONSULTA datos reales. Nunca inventes cifras. Siempre usa query_database.
   - Haz consultas exploratorias si necesitas descubrir IDs, nombres de canales, turnos, etc.
   - Encadena múltiples queries: primero exploratorio → luego específico.
   - Si una query regresa vacío, ajusta filtros y vuelve a intentar.

3. ANALIZA como experto. No solo reportas datos — interpretas, comparas con benchmarks y das contexto.

4. RESPONDE con estructura cuando sea relevante:

**📊 Datos**
[Tabla Markdown con cifras clave]

**💡 Hallazgos**
- [Hallazgo con dato + comparación vs benchmark o mes anterior]

**✅ Sugerencias**
- [Acción concreta y específica]

**❓ Preguntas sugeridas**
- ¿[Pregunta de seguimiento relevante]?

(Para respuestas simples omite las secciones y responde directo)

══════════════════════════════════════════
BENCHMARKS DE LA INDUSTRIA RESTAURANTERA MEXICANA
══════════════════════════════════════════
- Food cost (compras/ventas):    ideal 28-35%  |  >38% = alerta roja
- Labor cost (nómina/ventas):    ideal 25-32%  |  >35% = alerta
- Prime cost (food+labor):       ideal <60%    |  >65% = zona de pérdida
- Gastos operativos:             ideal 10-15%
- Utilidad operativa:            saludable 15-25%
- Comisión delivery Rappi/Uber:  25-30% del pedido — impacto CRÍTICO en márgenes
- Ticket promedio QSR:           $120-$180 MXN  |  Casual dining: $250-$450 MXN
- Merma aceptable:               <3% del inventario

REGLAS ADICIONALES:
- Responde SIEMPRE en español.
- Formatea montos como moneda MXN ($12,345.00).
- Usa tablas Markdown para datos comparativos o listas.
- NUNCA expongas nombres técnicos de tablas al usuario.
- NUNCA digas "no tengo acceso a datos" sin antes intentar al menos una query.
- Si hay sucursal activa (branchId), filtra SIEMPRE por IdSucursal=${branchId}.
- Los meses en la BD son 1-12. Ya están convertidos en el bloque PERÍODO arriba.
- Si ves comisiones de canales delivery altas (>25%), menciona el impacto en rentabilidad.
- Al comparar meses, SIEMPRE menciona los nombres de los meses en tu respuesta (ej. "Mayo vs Abril").
`;
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

        const systemPrompt = buildSystemPrompt(context || {});
        const executedSql: string[] = [];

        const conversationMessages: { role: 'user' | 'assistant'; content: any }[] = messages.map((m: any) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
        }));

        let turns     = 0;
        let finalText = '';

        while (turns < MAX_TURNS) {
            turns++;

            const resp = await anthropic.messages.create({
                model:      resolvedModel,
                max_tokens: 8192,
                system:     systemPrompt,
                tools:      AGENT_TOOLS,
                tool_choice: { type: 'auto' },
                messages:   conversationMessages,
            });

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
                    modelUsed: resolvedModel,
                    executedSql: executedSql.join(';\n'),
                });
            }

            // Process all query_database tool calls
            conversationMessages.push({ role: 'assistant', content: resp.content });

            const toolResults: any[] = [];
            for (const block of resp.content) {
                if (block.type !== 'tool_use') continue;

                const sql = (block.input as any)?.sql || '';
                if (sql) executedSql.push(sql);

                try {
                    const rows = await executeQuery(connection, sql);
                    // Cap result size to avoid token overflow
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

            conversationMessages.push({ role: 'user', content: toolResults });
        }

        return NextResponse.json({
            content:    finalText,
            modelUsed:  resolvedModel,
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
