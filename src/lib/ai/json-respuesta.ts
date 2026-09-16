/**
 * Saca el objeto JSON de una respuesta de la IA.
 *
 * Antes estas rutas pedían `response_format: { type: 'json_object' }`, que solo
 * existe en el API de OpenAI. Ahora el proveedor lo decide HL Console y puede
 * ser Claude, así que el JSON se pide en el prompt y se extrae aquí: se recorta
 * el bloque ```json de adorno y se toma desde la primera llave hasta la última.
 */
export function extraerJson<T = Record<string, unknown>>(texto: string): T {
    const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    const inicio = limpio.indexOf('{');
    const fin = limpio.lastIndexOf('}');
    if (inicio < 0 || fin <= inicio) {
        throw new Error('La IA no devolvió un objeto JSON');
    }
    return JSON.parse(limpio.slice(inicio, fin + 1)) as T;
}
