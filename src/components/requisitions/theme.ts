/**
 * Contraste para la pantalla táctil de requisiciones.
 *
 * El color de marca del proyecto es libre: hay proyectos con naranja claro
 * (#FF6B35) y otros con morado saturado (#7033ff). Pintar texto de un color
 * fijo sobre ese fondo funciona para unos y deja el texto ilegible en otros
 * (#7033ff con texto casi negro da 3.25:1, debajo del mínimo AA de 4.5:1).
 * Por eso el color del texto se calcula, nunca se asume.
 */

/** Tinta y papel del esquema claro. */
export const INK = '#0b1220';
export const INK_SOFT = '#475569';
/** Gris de etiquetas: elegido para pasar 4.5:1 tanto sobre PAPER como sobre CANVAS. */
export const INK_MUTED = '#5b6878';
export const PAPER = '#ffffff';
export const CANVAS = '#eef1f5';
export const BORDER = '#cbd5e1';

function parseHex(hex: string): [number, number, number] | null {
    const clean = (hex || '').trim().replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    if (!/^[0-9a-f]{6}$/i.test(full)) return null;
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function relativeLuminance(hex: string): number | null {
    const rgb = parseHex(hex);
    if (!rgb) return null;
    const [r, g, b] = rgb
        .map(v => v / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste WCAG entre dos colores (1 = idénticos, 21 = negro/blanco). */
export function contrastRatio(a: string, b: string): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    if (la === null || lb === null) return 1;
    const light = Math.max(la, lb);
    const dark = Math.min(la, lb);
    return (light + 0.05) / (dark + 0.05);
}

/**
 * Color de texto legible sobre un fondo: elige entre tinta y blanco el que
 * más contraste dé. Un botón morado recibe texto blanco; uno naranja, negro.
 */
export function foregroundFor(background: string): string {
    return contrastRatio(background, INK) >= contrastRatio(background, PAPER) ? INK : PAPER;
}

/**
 * Versión del acento utilizable como TEXTO sobre fondo claro. Si el color de
 * marca no alcanza 4.5:1 lo oscurece por pasos hasta que sí. Un naranja de
 * marca sobre blanco da 2.84:1 y saldría lavado; esto lo baja hasta que se lee.
 */
export function accentTextOn(accent: string, background: string = PAPER): string {
    const rgb = parseHex(accent);
    if (!rgb) return INK;

    let [r, g, b] = rgb;
    for (let step = 0; step < 20; step++) {
        const candidate = `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
        if (contrastRatio(candidate, background) >= 4.5) return candidate;
        r *= 0.88;
        g *= 0.88;
        b *= 0.88;
    }
    return INK;
}
