/**
 * Envío de documentos por WhatsApp desde el navegador.
 *
 * LÍMITE DE LA PLATAFORMA, importante: una liga `wa.me` SOLO puede llevar
 * texto. WhatsApp no permite adjuntar un archivo desde una URL, así que no
 * existe forma de abrir el chat de un contacto CON el PDF ya adjunto.
 *
 * Por eso hay dos caminos y se elige el mejor disponible:
 *
 *  1. `navigator.share` con archivos (celular y tablet modernos): abre la hoja
 *     nativa de compartir con el PDF ADJUNTO de verdad. El usuario elige
 *     WhatsApp y el contacto. Es el único camino que manda el archivo.
 *
 *  2. Liga `wa.me/<telefono>` (escritorio o navegador sin soporte): abre el
 *     chat DEL PROVEEDOR con el mensaje escrito, y el PDF se descarga para
 *     adjuntarlo a mano. Aquí sí se respeta el número, pero el archivo no
 *     viaja solo.
 */

export type WhatsAppResult =
    | { ok: true; via: 'share' }
    | { ok: true; via: 'link'; downloaded: boolean }
    | { ok: false; reason: 'cancelled' | 'no-phone' | 'failed' };

/**
 * Normaliza un teléfono al formato que espera wa.me: solo dígitos, con lada
 * de país. `tblProveedores.Telefonos` es texto libre y suele traer varios
 * números, espacios, guiones y paréntesis; se toma el primero utilizable.
 */
export function normalizePhone(raw: string | null | undefined, defaultCountryCode = '52'): string | null {
    if (!raw) return null;

    // Se queda con el primer número de la lista (separadores típicos: , / ;).
    const first = (String(raw).split(/[,;/|]/)[0] ?? '').trim();
    let digits = first.replace(/\D/g, '');
    if (!digits) return null;

    // ¿Trae lada de país explícita? Distinguirlo importa: si ya la trae, volver
    // a anteponerla produce un número que existe pero es de OTRA persona. Ante
    // un número explícito pero incompleto se prefiere descartarlo.
    const hasExplicitCountry = first.startsWith('+') || digits.startsWith('00');
    if (digits.startsWith('00')) digits = digits.slice(2);

    if (!hasExplicitCountry) {
        // Prefijo nacional de larga distancia, ya en desuso.
        if (digits.length === 12 && digits.startsWith('01')) digits = digits.slice(2);
        // 10 dígitos = número nacional sin lada de país.
        if (digits.length === 10) digits = defaultCountryCode + digits;
    }

    // México se captura a veces como 521XXXXXXXXXX; el 1 de celular es legado.
    if (digits.length === 13 && digits.startsWith('521')) digits = '52' + digits.slice(3);

    // Rango razonable para un número internacional completo.
    if (digits.length < 11 || digits.length > 15) return null;
    return digits;
}

/** Fuerza la descarga de un blob con el nombre indicado. */
function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // El revoke inmediato cancela la descarga en algunos navegadores.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

interface SendOptions {
    blob: Blob;
    filename: string;
    message: string;
    /** Teléfono del proveedor, tal como está capturado. */
    phone?: string | null;
}

/**
 * Manda el PDF por WhatsApp. Intenta primero adjuntar el archivo de verdad;
 * si el dispositivo no lo soporta, abre el chat del proveedor y descarga el
 * PDF para adjuntarlo a mano.
 */
export async function sendPdfViaWhatsApp({ blob, filename, message, phone }: SendOptions): Promise<WhatsAppResult> {
    const file = new File([blob], filename, { type: 'application/pdf' });

    // Camino 1: hoja nativa con el archivo adjunto.
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], text: message });
            return { ok: true, via: 'share' };
        } catch (error) {
            // El usuario cerró la hoja: no es un fallo, no hay que insistir.
            if (error instanceof DOMException && error.name === 'AbortError') {
                return { ok: false, reason: 'cancelled' };
            }
            // Cualquier otro error cae al camino 2.
        }
    }

    // Camino 2: chat del proveedor + descarga del PDF.
    const normalized = normalizePhone(phone);
    downloadBlob(blob, filename);

    const target = normalized
        ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(target, '_blank', 'noopener,noreferrer');
    return normalized
        ? { ok: true, via: 'link', downloaded: true }
        : { ok: false, reason: 'no-phone' };
}
