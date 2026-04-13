import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getProjectConnection } from '@/lib/dynamic-db';

// Helper to execute SQL queries safely (read-only)
async function executeQuery(connection: any, sql: string) {
    if (!sql.toLowerCase().trim().startsWith('select')) {
        throw new Error('Solo se permiten consultas de lectura (SELECT).');
    }
    
    try {
        const [rows] = await connection.execute(sql);
        return rows;
    } catch (error: any) {
        console.error("❌ SQL EXECUTION ERROR:", error.message);
        console.error("Statement:", sql);
        throw error;
    }
}

const DATABASE_SCHEMA = `
TABLAS Y VISTAS DISPONIBLES:
- tblSucursales: IdSucursal, Sucursal (Nombre de sucursal)
- tblVentas: Dia, Mes, Anio, IdTurno, IdPlataforma, Venta (monto), IdSucursal
- tblNomina: Dia, Mes, Anio, IdUsuario, Pago (monto), IdSucursal
- tblGastos: Dia, Mes, Anio, IdConceptoGasto, Gasto (monto), IdSucursal
- tblCompras: IdCompra, ConceptoCompra, FechaCompra, IdProveedor, Total, IdSucursal
- tblDetalleCompras: IdDetalleCompra, IdCompra, IdProducto, Producto, Cantidad, Precio, Total
- tblInventarios: IdProducto, Dia, Mes, Anio, Cantidad, Precio, Consumo
- vlProductos: IdProducto, Producto, IdCategoria, Categoria, IdPresentacion, Presentacion, Precio (Usa esta vista para TODO lo relacionado a productos)
- tblCategorias: IdCategoria, Categoria
- tblProveedores: IdProveedor, Proveedor
- tblPuestos: IdPuesto, Puesto
- tblTurnos: IdTurno, Turno
- tblPlataformas: IdPlataforma, Plataforma
- tblPropinasEmpleados: IdEmpleado, IdSucursal, Dia, Mes, Anio, Ventas, MontoPropina
- tblEmpleados: IdEmpleado, Empleado, IdPuesto, IdSucursal

RELACIONES COMUNES:
- IdSucursal une ventas, nómina, gastos, etc.
- IdProducto une inventarios con productos (usa vlProductos).
- IdCategoria une productos con categorías.
`;

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'query_database',
            description: 'Ejecuta una consulta SQL SELECT para obtener datos precisos de la base de datos.',
            parameters: {
                type: 'object',
                properties: {
                    sql: {
                        type: 'string',
                        description: 'La consulta SQL SELECT a ejecutar.'
                    }
                },
                required: ['sql']
            }
        }
    }
];

export async function POST(req: Request) {
    let connection: any = null;
    try {
        const { messages, modelType, context, projectId } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
        }

        // Initialize connection if projectId is provided
        if (projectId) {
            connection = await getProjectConnection(projectId);
        }

        const systemPrompt = `Eres un experto analista de datos para negocios de comida (restaurantes). 
Tu objetivo es ayudar al usuario a entender sus KPIs y desempeño financiero basándote en los datos del dashboard y consultas directas a la base de datos.

${DATABASE_SCHEMA}

DATOS ACTUALES DEL DASHBOARD (RESUMEN):
${JSON.stringify(context, null, 2)}

Instrucciones:
1. Si necesitas datos específicos que no están en el resumen, usa la herramienta 'query_database'.
2. Usa SIEMPRE la vista 'vlProductos' para consultas de productos, NUNCA 'tblProductos'.
3. La base de datos es MySQL. Usa SIEMPRE 'LIMIT' al final de la consulta para limitar resultados. 
   - CORRECTO: SELECT * FROM tabla LIMIT 10
   - INCORRECTO: SELECT TOP 10 * FROM tabla
   'TOP' NO existe en MySQL y causará un error crítico.
4. Sé conciso y directo.
4. Responde siempre en español.
5. Usa tablas de Markdown para presentar listas de datos, resultados de consultas o comparativas siempre que sea posible.
6. NUNCA menciones nombres de tablas técnicas al usuario, explícalo de forma clara.
7. Siempre verifica qué sucursal, mes y año están seleccionados en el contexto antes de consultar.
`;

        if (modelType === 'gpt-4o') {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            
            let response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "system", content: systemPrompt }, ...messages],
                tools: TOOLS as any,
                tool_choice: 'auto'
            });

            let responseMessage = response.choices[0].message;
            let executedSql: string[] = [];

            // Handle tool calls
            if (responseMessage.tool_calls) {
                const toolMessages = [...messages, responseMessage];
                
                for (const toolCall of responseMessage.tool_calls) {
                    // Type narrowing for toolCall
                    if (toolCall.type !== 'function') continue;
                    
                    const functionArgs = JSON.parse(toolCall.function.arguments);
                    if (functionArgs.sql) executedSql.push(functionArgs.sql);

                    try {
                        if (!connection) throw new Error("No hay conexión a la base de datos del proyecto disponible.");
                        const queryResult = await executeQuery(connection, functionArgs.sql);
                        toolMessages.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            content: JSON.stringify(queryResult),
                        } as any);
                    } catch (err: any) {
                        toolMessages.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            content: JSON.stringify({ error: err.message }),
                        } as any);
                    }
                }

                const secondResponse = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [{ role: "system", content: systemPrompt }, ...toolMessages],
                });

                return NextResponse.json({ 
                    content: secondResponse.choices[0].message.content, 
                    modelUsed: 'gpt-4o',
                    executedSql: executedSql.join(';\n')
                });
            }

            return NextResponse.json({ content: responseMessage.content, modelUsed: 'gpt-4o' });

        } else if (modelType === 'claude') {
            const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            let executedSql: string[] = [];

            const claudeTools: any = [
                {
                    name: 'query_database',
                    description: 'Ejecuta una consulta SQL SELECT para obtener datos precisos de la base de datos.',
                    input_schema: {
                        type: 'object',
                        properties: {
                            sql: { type: 'string', description: 'La consulta SQL SELECT a ejecutar.' }
                        },
                        required: ['sql']
                    }
                }
            ];

            let response = await anthropic.messages.create({
                model: "claude-3-5-sonnet-latest",
                max_tokens: 2048,
                system: systemPrompt,
                tools: claudeTools,
                messages: messages.map((m: any) => ({
                    role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
                    content: m.content
                })),
            });

            if (response.stop_reason === 'tool_use') {
                const toolUse: any = response.content.find(c => c.type === 'tool_use');
                const toolResultMessages: { role: 'user' | 'assistant', content: any }[] = messages.map((m: any) => ({
                    role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
                    content: m.content
                }));
                
                toolResultMessages.push({ role: 'assistant' as const, content: response.content });

                if (toolUse) {
                    if (toolUse.input.sql) executedSql.push(toolUse.input.sql);

                    try {
                        if (!connection) throw new Error("No hay conexión a la base de datos del proyecto disponible.");
                        const result = await executeQuery(connection, toolUse.input.sql);
                        toolResultMessages.push({
                            role: 'user',
                            content: [
                                {
                                    type: 'tool_result',
                                    tool_use_id: toolUse.id,
                                    content: JSON.stringify(result)
                                }
                            ]
                        });
                    } catch (err: any) {
                        toolResultMessages.push({
                            role: 'user',
                            content: [
                                {
                                    type: 'tool_result',
                                    tool_use_id: toolUse.id,
                                    content: JSON.stringify({ error: err.message }),
                                    is_error: true
                                }
                            ]
                        });
                    }
                }

                const finalResponse = await anthropic.messages.create({
                    model: "claude-3-5-sonnet-latest",
                    max_tokens: 2048,
                    system: systemPrompt,
                    tools: claudeTools,
                    messages: toolResultMessages,
                });

                const content = finalResponse.content[0].type === 'text' ? finalResponse.content[0].text : '';
                return NextResponse.json({ 
                    content, 
                    modelUsed: 'claude-3-5-sonnet',
                    executedSql: executedSql.join(';\n')
                });
            }

            const content = response.content[0].type === 'text' ? response.content[0].text : '';
            return NextResponse.json({ content, modelUsed: 'claude-3-5-sonnet' });
        }

        return NextResponse.json({ error: 'Invalid model type' }, { status: 400 });

    } catch (error: any) {
        console.error('AI Chat Error:', error);
        return NextResponse.json({ error: 'Error en la comunicación con la IA', details: error.message }, { status: 500 });
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (endError) {
                console.error('Error closing project connection:', endError);
            }
        }
    }
}
