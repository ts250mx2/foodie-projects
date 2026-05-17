'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export type ButtonVariant = 'primary' | 'solid' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize    = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?:   ButtonVariant;
    size?:      ButtonSize;
    isLoading?: boolean;
    leftIcon?:  React.ElementType;
    rightIcon?: React.ElementType;
    /** Envuelve el leftIcon en una cajita cuadrada translúcida */
    iconBox?:   boolean;
    children:   React.ReactNode;
}

const SIZE: Record<ButtonSize, string> = {
    sm: 'h-7  px-3   text-xs  gap-1.5 rounded-md',
    md: 'h-9  px-4   text-sm  gap-2   rounded-lg',
    lg: 'h-10 px-5   text-sm  gap-2   rounded-lg',
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 12, md: 14, lg: 14 };

/* Tamaño de la caja del ícono por size */
const ICON_BOX_SIZE: Record<ButtonSize, string> = {
    sm: 'w-4 h-4 rounded',
    md: 'w-5 h-5 rounded-md',
    lg: 'w-6 h-6 rounded-md',
};

export default function Button({
    variant   = 'primary',
    size      = 'md',
    isLoading = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    iconBox   = false,
    children,
    className = '',
    disabled,
    style,
    ...props
}: ButtonProps) {
    const { colors } = useTheme();

    const base = [
        'inline-flex items-center justify-center font-medium leading-none',
        'transition-all duration-150 ease-out',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'select-none focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-offset-2',
        SIZE[size],
    ].join(' ');

    let cls    = '';
    let vStyle: React.CSSProperties = {};

    switch (variant) {
        /* ── Gradient (llamativo) ── */
        case 'primary':
            cls = [
                'text-white',
                'shadow-[0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.12)]',
                'hover:shadow-[0_2px_6px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.12)]',
                'hover:brightness-[1.06]',
                'active:brightness-95 active:shadow-none active:scale-[0.98]',
            ].join(' ');
            vStyle = {
                background: `linear-gradient(160deg, ${colors.colorFondo1} 0%, ${colors.colorFondo2} 100%)`,
                color: colors.colorLetra,
            };
            break;

        /* ── Sólido limpio (sin gradiente) ── */
        case 'solid':
            cls = [
                'text-white font-semibold',
                'shadow-[0_1px_3px_rgba(0,0,0,0.18)]',
                'hover:opacity-[0.88]',
                'hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)]',
                'active:opacity-100 active:scale-[0.97] active:shadow-none',
            ].join(' ');
            vStyle = {
                backgroundColor: colors.colorFondo1,
                color: colors.colorLetra,
            };
            break;

        /* ── Secundario (blanco + borde) ── */
        case 'secondary':
            cls = [
                'bg-white text-gray-700',
                'border border-gray-200',
                'shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
                'hover:bg-gray-50 hover:border-gray-300',
                'hover:shadow-[0_2px_4px_rgba(0,0,0,0.08)]',
                'active:bg-gray-100 active:scale-[0.98] active:shadow-none',
            ].join(' ');
            break;

        /* ── Outline (borde del color de marca) ── */
        case 'outline':
            cls = [
                'bg-transparent border',
                'hover:bg-[currentColor]/5',
                'active:bg-[currentColor]/10 active:scale-[0.98]',
            ].join(' ');
            vStyle = {
                borderColor: colors.colorFondo1,
                color: colors.colorFondo1,
            };
            break;

        /* ── Ghost (solo texto) ── */
        case 'ghost':
            cls = [
                'bg-transparent text-gray-500',
                'hover:bg-gray-100 hover:text-gray-800',
                'active:bg-gray-200 active:scale-[0.98]',
            ].join(' ');
            break;

        /* ── Danger ── */
        case 'danger':
            cls = [
                'bg-red-500 text-white font-semibold',
                'shadow-[0_1px_2px_rgba(0,0,0,0.12)]',
                'hover:bg-red-600 hover:shadow-[0_2px_6px_rgba(239,68,68,0.35)]',
                'active:bg-red-700 active:scale-[0.98] active:shadow-none',
            ].join(' ');
            break;
    }

    const iconSz    = ICON_SIZE[size];
    const boxCls    = ICON_BOX_SIZE[size];

    /* Color de la caja del ícono según la variante */
    const iconBoxBg: Record<ButtonVariant, string> = {
        primary:   'bg-white/25',
        solid:     'bg-white/25',
        danger:    'bg-white/20',
        outline:   'bg-current/10',
        secondary: 'bg-gray-100',   // gris sobre blanco
        ghost:     'bg-gray-200',
    };

    /* Renderiza el ícono izquierdo, con o sin caja */
    function renderLeftIcon() {
        if (!LeftIcon) return null;
        if (iconBox) {
            return (
                <span className={`shrink-0 flex items-center justify-center ${boxCls} ${iconBoxBg[variant]}`}>
                    <LeftIcon size={iconSz} strokeWidth={2.5} />
                </span>
            );
        }
        return <LeftIcon size={iconSz} className="shrink-0" strokeWidth={2} />;
    }

    return (
        <button
            className={`${base} ${cls} ${className}`}
            disabled={disabled || isLoading}
            style={{ ...vStyle, ...style }}
            {...props}
        >
            {isLoading
                ? <Loader2 size={iconSz} className="animate-spin shrink-0" />
                : renderLeftIcon()
            }

            <span>{children}</span>

            {!isLoading && RightIcon && (
                <RightIcon size={iconSz} className="shrink-0" strokeWidth={2} />
            )}
        </button>
    );
}
