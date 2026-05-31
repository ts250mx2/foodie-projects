import React from 'react';

/**
 * Formas geométricas del lenguaje visual de Foodie Gurú (estilo Bauhaus).
 * Círculos, medios círculos, cuartos de círculo y anillos (donas) que se
 * usan como acento decorativo en paneles de marca, headers y empty states.
 *
 * Ejemplo:
 *   <GeoShape variant="half-bottom" color="var(--color-brand-green)"
 *             size={320} className="absolute -top-10 -left-16" />
 */
export type GeoVariant =
    | 'circle' | 'donut'
    | 'half-top' | 'half-bottom' | 'half-left' | 'half-right'
    | 'quarter-tl' | 'quarter-tr' | 'quarter-br' | 'quarter-bl';

interface GeoShapeProps {
    variant: GeoVariant;
    /** Lado mayor en px */
    size?: number;
    /** Cualquier color CSS (hex, var(--color-brand-*), etc.) */
    color?: string;
    /** Grosor del anillo en px (solo para variant="donut") */
    ring?: number;
    className?: string;
    style?: React.CSSProperties;
}

const RADIUS: Record<GeoVariant, string> = {
    circle:        '9999px',
    donut:         '9999px',
    'half-top':    '9999px 9999px 0 0',
    'half-bottom': '0 0 9999px 9999px',
    'half-left':   '9999px 0 0 9999px',
    'half-right':  '0 9999px 9999px 0',
    'quarter-tl':  '100% 0 0 0',
    'quarter-tr':  '0 100% 0 0',
    'quarter-br':  '0 0 100% 0',
    'quarter-bl':  '0 0 0 100%',
};

export default function GeoShape({
    variant,
    size = 120,
    color = 'currentColor',
    ring = 16,
    className = '',
    style,
}: GeoShapeProps) {
    const isDonut = variant === 'donut';

    // Los medios círculos son rectángulos 2:1; el resto son cuadrados.
    let width = size;
    let height = size;
    if (variant === 'half-top' || variant === 'half-bottom') height = size / 2;
    if (variant === 'half-left' || variant === 'half-right') width = size / 2;

    return (
        <span
            aria-hidden="true"
            className={`block pointer-events-none ${className}`}
            style={{
                width,
                height,
                borderRadius: RADIUS[variant],
                background: isDonut ? 'transparent' : color,
                border: isDonut ? `${ring}px solid ${color}` : undefined,
                ...style,
            }}
        />
    );
}
