/**
 * Persistencia de la conversación con el agente Foodie Gurú.
 *
 * Se guarda POR PROYECTO. Antes vivía en una sola llave de localStorage y el
 * historial del proyecto anterior reaparecía al entrar a otro: la charla trae
 * ventas, costos y nómina en texto plano, así que era una fuga de datos entre
 * clientes distintos que comparten la misma computadora o el mismo navegador.
 *
 * Vive aparte del componente para que el logout pueda barrer el historial sin
 * importar el widget completo del agente.
 */

export const CHAT_STORAGE_PREFIX = 'foodie-guru-chat:';

/** Llaves sin proyecto de versiones anteriores: se borran en cuanto se ven. */
export const LEGACY_CHAT_KEYS = ['foodie-guru-chat-v2', 'foodie-guru-chat'];

export const chatStorageKey = (idProyecto: number | string) => `${CHAT_STORAGE_PREFIX}${idProyecto}`;

/** Proyecto de la sesión vigente; null si no hay sesión abierta. */
export function currentProjectId(): number | null {
    try {
        const id = JSON.parse(localStorage.getItem('project') || '{}')?.idProyecto;
        return id == null ? null : Number(id);
    } catch {
        return null;
    }
}

/** Borra el historial heredado de versiones que guardaban sin proyecto. */
export function clearLegacyChatHistory() {
    LEGACY_CHAT_KEYS.forEach(key => {
        try { localStorage.removeItem(key); } catch { }
    });
}

/** Borra TODA conversación guardada, de cualquier proyecto (logout). */
export function clearAllChatHistory() {
    clearLegacyChatHistory();
    try {
        Object.keys(localStorage)
            .filter(key => key.startsWith(CHAT_STORAGE_PREFIX))
            .forEach(key => localStorage.removeItem(key));
    } catch { }
}
