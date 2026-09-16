import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
    HlClienteError,
    agenteConfigurado,
    configProxy,
    obtenerAgente,
    type AgenteHl,
    type EntornoHl,
    type ApiIA,
} from '@/lib/hl-cliente';

// Adaptador de proveedor para toda la IA de Foodie (mismo patrón que el agente
// Vico de vidaurri-ia): el loop siempre habla "formato Anthropic" (mensajes con
// bloques tool_use / tool_result) y aquí se enruta por proveedor.
//
// Proveedor y modelo salen de HL Console (ver src/lib/hl-cliente.ts y el
// proyecto hl-servidor), del agente HL_AGENTE_FOODIE. Del .env ya no se lee
// ningún modelo ni llave de proveedor: eso se administra en el portal de HL.
// Por eso ninguna ruta ni pantalla de esta app elige modelo.
//
// Las llamadas van por el PROXY de HL: el SDK oficial apunta a
// /api/ws/proxy/<uuid> con la key de la app, y HL inyecta la llave real y fija
// el modelo del agente. Esta aplicación nunca tiene en memoria una llave de
// Anthropic ni de OpenAI; si este servidor se compromete, no hay llaves de
// proveedor que robarle.
//
// Respaldo: si HL_AGENTE_RESPALDO está configurado, la credencial lleva adentro
// la de respaldo. Si el turno falla por causas del servicio o de la cuenta (ver
// esFalloDelServicio), se repite con ella; como cada llamada traduce la
// conversación completa, cambiar de proveedor a media conversación no pierde
// contexto.

/** Proveedores que este adaptador sabe correr. */
export type ProveedorIA = 'claude' | 'openai';

/** Con qué corre un turno: lo que HL dice del agente y su entrada al proxy. */
export interface CredencialIA {
    proveedor: ProveedorIA;
    modelo: string;
    /** Entrada del proxy de HL para este agente; la llave del proveedor no llega aquí. */
    baseURL: string;
    headers: Record<string, string>;
    /** A qué credencial cae el turno si esta falla (HL_AGENTE_RESPALDO); null o ausente = sin respaldo. */
    respaldo?: CredencialIA | null;
    /** De qué agente de HL salió: permite volver a pedirla si HL avisa que cambió de proveedor. */
    agente?: AgenteHl;
    /** Nombre del proveedor en HL ('claude', 'deepseek'...) para decir quién contestó; `proveedor` solo dice el SDK. */
    proveedorHl?: string;
}

/** El SDK exige una llave; la real la pone HL en el proxy. */
const LLAVE_DE_PASO = 'hl';

export interface UsoHerramienta {
    id: string;
    name: string;
    input: Record<string, unknown>;
}

export interface TurnoAgente extends CredencialIA {
    sistema: string | Anthropic.TextBlockParam[];
    herramientas: Anthropic.Tool[];
    mensajes: Anthropic.MessageParam[];
    maxTokens: number;
    /** Última ronda: fuerza respuesta de texto sin herramientas. */
    sinHerramientas?: boolean;
    alTexto: (fragmento: string) => void;
    /** Avisa en cuanto empieza a llegar una llamada a herramienta (para borrar el preámbulo en la UI). */
    alUsarHerramienta?: () => void;
    /**
     * Avisa antes de CADA intento (el normal y el del respaldo). Quien acumula
     * texto del turno lo usa para empezar de cero: si el primer intento alcanzó
     * a abrir una herramienta y luego falló, su estado no debe silenciar el
     * texto que sí emita el respaldo.
     */
    alIniciarIntento?: () => void;
}

export interface ResultadoTurno {
    contenido: Anthropic.ContentBlock[];
    usos: UsoHerramienta[];
    /** Si el turno terminó porque el modelo pidió herramientas. */
    pidioHerramientas: boolean;
    /** Modelo que contestó de verdad (el respaldo, si el principal falló). */
    modelo: string;
    /** Proveedor en HL que contestó ('claude', 'deepseek'...). */
    proveedor?: string;
}

/** Con qué proveedor y modelo se atendió una respuesta: lo que se le muestra a quien pregunta. */
export interface IAUsada {
    proveedor: string;
    modelo: string;
}

/** Proveedores que hablan el API de OpenAI: por el proxy de HL se corren con el SDK de OpenAI. */
const COMPATIBLES_OPENAI = new Set(['openai', 'deepseek', 'groq', 'mistral', 'xai', 'openrouter', 'kimi', 'qwen', 'glm']);

/**
 * Con qué SDK se corre el proveedor que manda HL. Manda el campo `api` de HL
 * (anthropic | openai | gemini); si HL es anterior y no lo trae, se deduce del
 * nombre. null para gemini, otro… que este adaptador no sabe correr.
 */
export function proveedorSoportado(proveedor: string, api?: ApiIA | null): ProveedorIA | null {
    if (api === 'anthropic') return 'claude';
    if (api === 'openai') return 'openai';
    if (api) return null;
    const limpio = proveedor.trim().toLowerCase();
    if (limpio === 'claude') return 'claude';
    return COMPATIBLES_OPENAI.has(limpio) ? 'openai' : null;
}

export interface DependenciasHl {
    /** Quién le pregunta a HL por el agente (inyectable en pruebas). */
    obtener?: typeof obtenerAgente;
    env?: EntornoHl;
}

/**
 * Proveedor, modelo y entrada al proxy con que corre el agente, según HL. Sube
 * un HlClienteError si HL no contesta (y no hay nada previo en cache) o si
 * asigna un proveedor que aquí no se sabe correr.
 */
export async function credencialDeAgente(
    agente: AgenteHl,
    { obtener = obtenerAgente, env = process.env }: DependenciasHl = {}
): Promise<CredencialIA> {
    const { proveedor, modelo, api } = await obtener(agente, { env });
    const soportado = proveedorSoportado(proveedor, api);
    if (!soportado) {
        throw new HlClienteError(
            `HL asignó al agente ${agente} el proveedor "${proveedor}", que este sistema no sabe correr (solo los que hablan el API de Anthropic o de OpenAI)`
        );
    }
    return { proveedor: soportado, modelo, ...configProxy(agente, env), agente, proveedorHl: proveedor.trim().toLowerCase() };
}

/** Lo que ve el usuario cuando HL no dio credencial; el detalle va al log. */
export const ERROR_SIN_IA = 'El servicio de IA no está disponible en este momento; intenta de nuevo en unos minutos';

/**
 * Resultado plano (no unión discriminada) a propósito: este proyecto compila
 * con `strict: false` y ahí TypeScript no estrecha la unión por `ok`, así que
 * `error` tiene que existir siempre para poder leerlo tras comprobar `ok`.
 */
export interface CredencialParaRuta {
    ok: boolean;
    /** La credencial cuando ok es true; null cuando HL no la dio. */
    credencial: CredencialIA | null;
    /** Mensaje presentable cuando ok es false; null cuando sí hubo credencial. */
    error: string | null;
}

function mismaCredencial(a: CredencialIA, b: CredencialIA): boolean {
    return a.proveedor === b.proveedor && a.modelo === b.modelo && a.baseURL === b.baseURL;
}

/**
 * Para las rutas: la credencial del agente —con la de respaldo adentro, si HL
 * la dio— o un mensaje presentable. Nunca sube: el motivo (HL caído, key
 * inválida, IP no autorizada, llave caducada, proveedor no soportado) queda en
 * el log, que es donde sirve.
 *
 * El respaldo es opcional (HL_AGENTE_RESPALDO) y se pide junto con el agente,
 * sin sumar espera. Si HL no da el del agente pero sí el de respaldo —la llave
 * del agente caducó o está desactivada en el portal—, la IA corre con la de
 * respaldo en vez de quedarse muda.
 */
export async function credencialParaRuta(
    agente: Exclude<AgenteHl, 'respaldo'> = 'foodie',
    { obtener = obtenerAgente, env = process.env }: DependenciasHl = {}
): Promise<CredencialParaRuta> {
    const [principal, respaldo] = await Promise.allSettled([
        credencialDeAgente(agente, { obtener, env }),
        agenteConfigurado('respaldo', env)
            ? credencialDeAgente('respaldo', { obtener, env })
            : Promise.resolve(null),
    ]);

    if (respaldo.status === 'rejected') {
        console.error('[hl] sin credencial de respaldo (HL_AGENTE_RESPALDO):', respaldo.reason);
    }
    const deRespaldo = respaldo.status === 'fulfilled' ? respaldo.value : null;

    if (principal.status === 'fulfilled') {
        const util = deRespaldo && !mismaCredencial(deRespaldo, principal.value) ? deRespaldo : null;
        return { ok: true, credencial: { ...principal.value, respaldo: util }, error: null };
    }

    console.error(`[hl] sin credencial para el agente ${agente}:`, principal.reason);
    if (deRespaldo) {
        console.warn(`[hl] el agente ${agente} corre con la credencial de respaldo (${deRespaldo.modelo})`);
        return { ok: true, credencial: { ...deRespaldo, respaldo: null }, error: null };
    }
    return { ok: false, credencial: null, error: ERROR_SIN_IA };
}

/**
 * ¿Conviene repetir el turno en el otro proveedor? Sin conexión o timeout,
 * límite de peticiones (429), conflicto/timeout del servidor (408/409) o error
 * 5xx (incluido el 529 "overloaded" de Anthropic).
 *
 * También el 401 (`authentication_error`: llave inválida o revocada) y el 403
 * (`permission_error`, o `billing_error` cuando la cuenta se quedó sin saldo).
 * Esos dos no son fallos del servicio sino de configuración o de cuenta, pero
 * el usuario los ve igual —la IA se calla—, así que se atiende con el respaldo
 * y el motivo queda en el log.
 *
 * Un 400 o un 404 sí es de nuestra petición: repetirla en otro modelo daría el
 * mismo error.
 */
export function esFalloDelServicio(error: unknown): boolean {
    if (error instanceof Anthropic.APIConnectionError || error instanceof OpenAI.APIConnectionError) return true;
    const status =
        error instanceof Anthropic.APIError || error instanceof OpenAI.APIError ? error.status : undefined;
    if (typeof status !== 'number') return false;
    if (status === 401 || status === 403) return true;
    return status === 408 || status === 409 || status === 429 || status >= 500;
}

/** Header con que HL Console codifica el motivo de un rechazo del proxy. */
const HL_ERROR_HEADER = 'x-hl-error';
const PROVEEDOR_CAMBIADO = 'PROVEEDOR_CAMBIADO';

function headerDeError(error: unknown, nombre: string): string | null {
    const headers = (error as { headers?: unknown }).headers;
    if (!headers) return null;
    if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(nombre);
    const plano = headers as Record<string, string | undefined>;
    return plano[nombre] ?? plano[nombre.toLowerCase()] ?? null;
}

/**
 * ¿HL avisó (422 + X-HL-Error: PROVEEDOR_CAMBIADO) que el agente ya corre en
 * otro proveedor? Pasa cuando en el portal cambian la llave del agente de
 * Claude a OpenAI (o al revés) y esta app aún tiene en cache el proveedor
 * anterior: el SDK que se usó ya no es el que toca.
 */
export function esCambioDeProveedor(error: unknown): boolean {
    const status =
        error instanceof Anthropic.APIError || error instanceof OpenAI.APIError ? error.status : undefined;
    return status === 422 && headerDeError(error, HL_ERROR_HEADER) === PROVEEDOR_CAMBIADO;
}

/** Vuelve a preguntar a HL por el agente saltándose el cache. */
function refrescarCredencial(agente: AgenteHl): Promise<CredencialIA> {
    return credencialDeAgente(agente, { obtener: (a, o) => obtenerAgente(a, { ...o, forzar: true }) });
}

function describirError(error: unknown): string {
    if (error instanceof Anthropic.APIError || error instanceof OpenAI.APIError) {
        return `${error.status ?? 'sin conexión'}: ${error.message}`;
    }
    return error instanceof Error ? error.message : String(error);
}

export interface OpcionesTurno {
    /** Credencial de respaldo; undefined = la que trae el turno, null = sin respaldo. */
    respaldo?: CredencialIA | null;
    /** Quién ejecuta el turno contra el proveedor (inyectable en pruebas). */
    ejecutar?: (turno: TurnoAgente) => Promise<ResultadoTurno>;
    /** Quién vuelve a pedir la credencial a HL cuando avisa que el agente cambió de proveedor (inyectable en pruebas). */
    refrescar?: (agente: AgenteHl) => Promise<CredencialIA>;
}

function ejecutarTurno(turno: TurnoAgente): Promise<ResultadoTurno> {
    return turno.proveedor === 'openai' ? turnoOpenAI(turno) : turnoAnthropic(turno);
}

/**
 * Corre un turno del agente. Si falla antes de empezar a contestar:
 *   - con aviso de HL de que el agente cambió de proveedor, se refresca la
 *     credencial y se repite el turno con el SDK que ahora toca;
 *   - con fallo del servicio y respaldo disponible, se repite con el respaldo.
 * Con texto ya emitido no se reintenta: el usuario lo vería dos veces.
 */
export async function correrTurnoAgente(turno: TurnoAgente, opciones: OpcionesTurno = {}): Promise<ResultadoTurno> {
    const ejecutar = opciones.ejecutar ?? ejecutarTurno;
    const refrescar = opciones.refrescar ?? refrescarCredencial;
    const respaldo = opciones.respaldo !== undefined ? opciones.respaldo : (turno.respaldo ?? null);

    let emitido = false;
    const alTexto = (fragmento: string) => {
        if (fragmento) emitido = true;
        turno.alTexto(fragmento);
    };
    // Cada intento arranca limpio para quien acumula el texto del turno.
    const intentar = (t: TurnoAgente) => {
        turno.alIniciarIntento?.();
        return ejecutar(t);
    };
    try {
        return await intentar({ ...turno, alTexto });
    } catch (error) {
        if (emitido) throw error;

        if (esCambioDeProveedor(error) && turno.agente) {
            const nueva = await refrescar(turno.agente);
            console.warn(`[hl] el agente ${turno.agente} ahora corre con ${nueva.proveedor} / ${nueva.modelo}; se repite el turno`);
            return intentar({ ...turno, ...nueva, alTexto, respaldo: null });
        }

        if (!respaldo || !esFalloDelServicio(error)) throw error;
        console.warn(`[respaldo] ${turno.modelo} falló (${describirError(error)}); se repite el turno con ${respaldo.modelo}`);
        try {
            // El respaldo no encadena otro respaldo: un solo reintento por turno.
            return await intentar({ ...turno, ...respaldo, alTexto, respaldo: null });
        } catch (errorRespaldo) {
            console.error(`[respaldo] ${respaldo.modelo} también falló (${describirError(errorRespaldo)})`);
            throw errorRespaldo;
        }
    }
}

/**
 * Una sola vuelta sin herramientas: devuelve el texto de la respuesta. Para
 * resúmenes, OCR y demás usos de un tiro. Comparte credencial, respaldo y
 * cambio de proveedor con correrTurnoAgente.
 */
export async function completarTexto(
    credencial: CredencialIA,
    opciones: {
        sistema?: string | Anthropic.TextBlockParam[];
        mensajes: Anthropic.MessageParam[];
        maxTokens: number;
    }
): Promise<{ texto: string; modelo: string; proveedor: string }> {
    const resultado = await correrTurnoAgente({
        ...credencial,
        sistema: opciones.sistema ?? '',
        herramientas: [],
        mensajes: opciones.mensajes,
        maxTokens: opciones.maxTokens,
        alTexto: () => {},
    });
    const texto = resultado.contenido
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
    return { texto, modelo: resultado.modelo, proveedor: resultado.proveedor ?? credencial.proveedorHl ?? credencial.proveedor };
}

// ---------- Anthropic ----------

/** El sistema va en bloques para poder cachear el prefijo estable entre rondas. */
function sistemaAnthropic(sistema: TurnoAgente['sistema']): Anthropic.TextBlockParam[] | undefined {
    if (Array.isArray(sistema)) return sistema.length ? sistema : undefined;
    if (!sistema.trim()) return undefined;
    return [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }];
}

async function turnoAnthropic(turno: TurnoAgente): Promise<ResultadoTurno> {
    // Por el proxy de HL: la llave va de paso y HL la sustituye por la real.
    const anthropic = new Anthropic({
        baseURL: turno.baseURL,
        apiKey: LLAVE_DE_PASO,
        defaultHeaders: turno.headers,
    });
    const sistema = sistemaAnthropic(turno.sistema);
    const conHerramientas = turno.herramientas.length > 0 && !turno.sinHerramientas;
    const stream = anthropic.messages.stream({
        model: turno.modelo,
        max_tokens: turno.maxTokens,
        ...(sistema ? { system: sistema } : {}),
        ...(conHerramientas ? { tools: turno.herramientas, tool_choice: { type: 'auto' as const } } : {}),
        messages: turno.mensajes,
    });
    stream.on('text', turno.alTexto);
    if (turno.alUsarHerramienta) {
        // En cuanto ARRANCA el bloque de herramienta, no cuando termina: así la
        // UI borra el preámbulo antes de que se vea el resto del turno.
        stream.on('streamEvent', (evento) => {
            if (evento.type === 'content_block_start' && evento.content_block.type === 'tool_use') {
                turno.alUsarHerramienta?.();
            }
        });
    }
    const resultado = await stream.finalMessage();

    const usos = resultado.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        .map((b) => ({ id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> }));
    const pidioHerramientas = resultado.stop_reason === 'tool_use' && usos.length > 0;
    return {
        contenido: resultado.content,
        usos: pidioHerramientas ? usos : [],
        pidioHerramientas,
        modelo: turno.modelo,
        proveedor: turno.proveedorHl ?? turno.proveedor,
    };
}

// ---------- OpenAI ----------

type MensajeOpenAI = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ParteUsuario = OpenAI.Chat.Completions.ChatCompletionContentPart;

/** Bloque de imagen de Anthropic → parte `image_url` con data URI para OpenAI. */
function imagenParaOpenAI(bloque: Anthropic.ImageBlockParam): ParteUsuario {
    const fuente = bloque.source;
    if (fuente.type === 'url') {
        return { type: 'image_url', image_url: { url: fuente.url, detail: 'high' } };
    }
    return {
        type: 'image_url',
        image_url: { url: `data:${fuente.media_type};base64,${fuente.data}`, detail: 'high' },
    };
}

/** Traduce el historial formato Anthropic al formato chat.completions. */
function traducirMensajes(
    sistema: TurnoAgente['sistema'],
    mensajes: Anthropic.MessageParam[]
): MensajeOpenAI[] {
    const textoSistema = Array.isArray(sistema) ? sistema.map((b) => b.text).join('\n\n') : sistema;
    const salida: MensajeOpenAI[] = textoSistema.trim()
        ? [{ role: 'system', content: textoSistema }]
        : [];

    for (const mensaje of mensajes) {
        if (typeof mensaje.content === 'string') {
            salida.push({ role: mensaje.role, content: mensaje.content });
            continue;
        }
        if (mensaje.role === 'assistant') {
            let texto = '';
            const llamadas: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
            for (const bloque of mensaje.content) {
                if (bloque.type === 'text') texto += bloque.text;
                if (bloque.type === 'tool_use') {
                    llamadas.push({
                        id: bloque.id,
                        type: 'function',
                        function: { name: bloque.name, arguments: JSON.stringify(bloque.input ?? {}) },
                    });
                }
            }
            salida.push({
                role: 'assistant',
                content: texto || null,
                ...(llamadas.length ? { tool_calls: llamadas } : {}),
            });
            continue;
        }

        // Usuario: los tool_result van como mensajes `tool` aparte; el texto y
        // las imágenes se juntan en UN mensaje multimodal para no perder el
        // vínculo entre la foto y la instrucción que la acompaña.
        const partes: ParteUsuario[] = [];
        for (const bloque of mensaje.content) {
            if (bloque.type === 'tool_result') {
                if (partes.length) {
                    salida.push({ role: 'user', content: [...partes] });
                    partes.length = 0;
                }
                salida.push({
                    role: 'tool',
                    tool_call_id: bloque.tool_use_id,
                    content: typeof bloque.content === 'string' ? bloque.content : JSON.stringify(bloque.content),
                });
            } else if (bloque.type === 'text') {
                partes.push({ type: 'text', text: bloque.text });
            } else if (bloque.type === 'image') {
                partes.push(imagenParaOpenAI(bloque));
            } else if (bloque.type === 'document') {
                // chat.completions no recibe PDFs. Si el agente de HL quedó en
                // OpenAI, el OCR de PDFs necesita un agente de Claude.
                throw new Error(
                    'El agente de HL está en OpenAI y no puede leer PDFs por este camino: usa imágenes o asígnale una llave de Claude en el portal de HL Console.'
                );
            }
        }
        if (partes.length) salida.push({ role: 'user', content: partes });
    }
    return salida;
}

async function turnoOpenAI(turno: TurnoAgente): Promise<ResultadoTurno> {
    // El SDK de OpenAI cuelga las rutas de la baseURL, así que el proxy lleva /v1.
    const openai = new OpenAI({
        baseURL: `${turno.baseURL}/v1`,
        apiKey: LLAVE_DE_PASO,
        defaultHeaders: turno.headers,
    });
    // Los modelos gpt-5.x son razonadores; chat.completions NO admite function
    // tools con reasoning_effort activo, así que se fuerza a 'none' (además va
    // más rápido para un agente con herramientas).
    const esRazonadorGpt5 = /^gpt-5/i.test(turno.modelo.trim());
    const conHerramientas = turno.herramientas.length > 0 && !turno.sinHerramientas;
    const stream = await openai.chat.completions.create({
        model: turno.modelo,
        max_completion_tokens: turno.maxTokens,
        messages: traducirMensajes(turno.sistema, turno.mensajes),
        ...(esRazonadorGpt5 ? { reasoning_effort: 'none' as const } : {}),
        ...(conHerramientas
            ? {
                  tools: turno.herramientas.map((h) => ({
                      type: 'function' as const,
                      function: {
                          name: h.name,
                          description: h.description ?? '',
                          parameters: (h.input_schema ?? { type: 'object' }) as Record<string, unknown>,
                      },
                  })),
              }
            : {}),
        stream: true,
    });

    let texto = '';
    let avisadaHerramienta = false;
    // Los tool_calls llegan fragmentados por índice: se acumulan aquí.
    const llamadas = new Map<number, { id: string; name: string; args: string }>();
    for await (const parte of stream) {
        const delta = parte.choices[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
            texto += delta.content;
            turno.alTexto(delta.content);
        }
        for (const llamada of delta.tool_calls ?? []) {
            if (!avisadaHerramienta) {
                avisadaHerramienta = true;
                turno.alUsarHerramienta?.();
            }
            const actual = llamadas.get(llamada.index) ?? { id: '', name: '', args: '' };
            if (llamada.id) actual.id = llamada.id;
            if (llamada.function?.name) actual.name += llamada.function.name;
            if (llamada.function?.arguments) actual.args += llamada.function.arguments;
            llamadas.set(llamada.index, actual);
        }
    }

    // Reconstruye bloques formato Anthropic para el historial del loop.
    const contenido: Anthropic.ContentBlock[] = [];
    if (texto) {
        contenido.push({ type: 'text', text: texto, citations: [] } as Anthropic.ContentBlock);
    }
    const usos: UsoHerramienta[] = [];
    for (const [, llamada] of [...llamadas.entries()].sort((a, b) => a[0] - b[0])) {
        let input: Record<string, unknown> = {};
        try {
            input = JSON.parse(llamada.args || '{}');
        } catch {
            // argumentos ilegibles: se pasa vacío y la herramienta reportará el error
        }
        usos.push({ id: llamada.id, name: llamada.name, input });
        contenido.push({
            type: 'tool_use',
            id: llamada.id,
            name: llamada.name,
            input,
        } as Anthropic.ContentBlock);
    }
    return { contenido, usos, pidioHerramientas: usos.length > 0, modelo: turno.modelo, proveedor: turno.proveedorHl ?? turno.proveedor };
}
