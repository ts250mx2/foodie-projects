'use client';

import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';

interface PageShellProps {
    title: string;
    subtitle?: string;
    icon?: React.ElementType;
    emoji?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}

const getEmojiByTitle = (title: string): string => {
    const lowerTitle = title.toLowerCase().trim();
    
    if (lowerTitle.includes('subreceta')) return '📖';
    if (lowerTitle.includes('platillo') || lowerTitle.includes('dish')) return '🍲';
    if (lowerTitle.includes('recetario') || lowerTitle.includes('categoría recetario')) return '📖';
    if (lowerTitle.includes('sucursal') || lowerTitle.includes('branch')) return '📍';
    if (lowerTitle.includes('proveedor') || lowerTitle.includes('supplier')) return '🚚';
    if (lowerTitle.includes('orden') || lowerTitle.includes('compra') || lowerTitle.includes('purchase')) return '📄';
    if (lowerTitle.includes('producto') || lowerTitle.includes('product')) return '🏷️';
    if (lowerTitle.includes('máximos') || lowerTitle.includes('mínimos') || lowerTitle.includes('min-max') || lowerTitle.includes('escala')) return '⚖️';
    if (lowerTitle.includes('carga inicial') || lowerTitle.includes('initial load')) return '🚀';
    if (lowerTitle.includes('canal') || lowerTitle.includes('channel')) return '🏪';
    if (lowerTitle.includes('pago') || lowerTitle.includes('terminal') || lowerTitle.includes('payment')) return '💳';
    if (lowerTitle.includes('nómina') || lowerTitle.includes('payroll')) return '💵';
    if (lowerTitle.includes('horario') || lowerTitle.includes('schedule')) return '📅';
    if (lowerTitle.includes('turno') || lowerTitle.includes('shift')) return '🕒';
    if (lowerTitle.includes('gasto') || lowerTitle.includes('expense')) return '💸';
    if (lowerTitle.includes('impuesto') || lowerTitle.includes('tax')) return '🧾';
    if (lowerTitle.includes('empleado') || lowerTitle.includes('employee')) return '🧑‍💼';
    if (lowerTitle.includes('módulo') || lowerTitle.includes('proyecto') || lowerTitle.includes('project')) return '📁';
    if (lowerTitle.includes('punto de equilibrio') || lowerTitle.includes('break even')) return '📈';
    if (lowerTitle.includes('merma') || lowerTitle.includes('waste')) return '🗑️';
    if (lowerTitle.includes('presentación') || lowerTitle.includes('presentation')) return '📦';
    if (lowerTitle.includes('categoría') || lowerTitle.includes('category')) return '🏷️';
    if (lowerTitle.includes('ocr') || lowerTitle.includes('recibo') || lowerTitle.includes('documento ocr') || lowerTitle.includes('receipt')) return '📸';

    return '';
};

export default function PageShell({
    title,
    subtitle,
    icon: Icon,
    emoji,
    actions,
    children,
    className = '',
    noPadding = false,
}: PageShellProps) {
    const { colors } = useTheme();

    const resolvedEmoji = emoji || getEmojiByTitle(title);

    return (
        <div className="flex flex-col min-h-full">

            {/* ── Page header (Floating Card) ─────────────────────────── */}
            <div className="shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">

                {/* Left: emoji/icon + title + subtitle */}
                <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            {resolvedEmoji ? (
                                <span className="text-[20px] shrink-0 leading-none mr-1" role="img" aria-label={title}>
                                    {resolvedEmoji}
                                </span>
                            ) : Icon ? (
                                <Icon 
                                    size={18} 
                                    className="shrink-0"
                                    style={{ color: colors.colorFondo1 }} 
                                />
                            ) : null}
                            <h1 className="text-[17px] font-semibold text-gray-900 leading-tight tracking-[-0.01em] truncate">
                                {title}
                            </h1>
                        </div>
                        {subtitle && (
                            <p className="text-[12px] text-gray-400 mt-1 leading-tight truncate">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right: action buttons */}
                {actions && (
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {actions}
                    </div>
                )}
            </div>

            {/* ── Page content ────────────────────────────────────────── */}
            <div className={`flex-1 flex flex-col mt-6 ${className}`}>
                {children}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
   Helpers reutilizables dentro de PageShell
───────────────────────────────────────────────────────────────────────── */

export function TableCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
            {children}
        </div>
    );
}

export function TableToolbar({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex-wrap">
            {children}
        </div>
    );
}

export function StatsGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
    const colsClass = {
        2: 'grid-cols-1 sm:grid-cols-2',
        3: 'grid-cols-1 sm:grid-cols-3',
        4: 'grid-cols-2 lg:grid-cols-4',
    }[cols];
    return <div className={`grid ${colsClass} gap-4`}>{children}</div>;
}

export function StatCard({
    label,
    value,
    icon: Icon,
    trend,
    trendLabel,
    color = '#7033ff',
}: {
    label: string;
    value: string | number;
    icon?: React.ElementType;
    trend?: 'up' | 'down' | 'neutral';
    trendLabel?: string;
    color?: string;
}) {
    const trendMeta = {
        up:      { cls: 'text-emerald-600 bg-emerald-50', arrow: '↑' },
        down:    { cls: 'text-red-500 bg-red-50',         arrow: '↓' },
        neutral: { cls: 'text-gray-500 bg-gray-100',      arrow: '→' },
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
                {Icon && (
                    <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}1a` }}>
                        <Icon size={16} style={{ color }} />
                    </div>
                )}
            </div>
            <div className="flex flex-col gap-1.5">
                <span className="text-2xl font-bold text-gray-900 leading-none tabular-nums">{value}</span>
                {trend && trendLabel && (
                    <span className={`self-start text-xs font-semibold px-2 py-0.5 rounded-full ${trendMeta[trend].cls}`}>
                        {trendMeta[trend].arrow} {trendLabel}
                    </span>
                )}
            </div>
        </div>
    );
}

export function PageCard({
    children,
    className = '',
    title,
    actions,
}: {
    children: React.ReactNode;
    className?: string;
    title?: string;
    actions?: React.ReactNode;
}) {
    return (
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
            {(title || actions) && (
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    {title && <h2 className="text-sm font-semibold text-gray-700">{title}</h2>}
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            )}
            <div className="p-5">{children}</div>
        </div>
    );
}
