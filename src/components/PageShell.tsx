'use client';

import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';

interface PageShellProps {
    title: string;
    subtitle?: string;
    icon?: React.ElementType;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}

export default function PageShell({
    title,
    subtitle,
    icon: Icon,
    actions,
    children,
    className = '',
    noPadding = false,
}: PageShellProps) {
    const { colors } = useTheme();

    return (
        <div className="flex flex-col min-h-full bg-gray-50/60">

            {/* ── Page header ─────────────────────────────────────────── */}
            <div className="shrink-0 bg-white border-b border-gray-200 flex items-stretch">

                {/* Left accent bar — fina franja de marca */}
                <div
                    className="w-[3px] shrink-0"
                    style={{
                        background: `linear-gradient(to bottom, ${colors.colorFondo1}, ${colors.colorFondo2})`,
                    }}
                />

                {/* Content row */}
                <div className="flex-1 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">

                    {/* Left: icon + title + subtitle */}
                    <div className="flex items-center gap-3.5 min-w-0">
                        {Icon && (
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{
                                    backgroundColor: `${colors.colorFondo1}14`,
                                    color: colors.colorFondo1,
                                }}
                            >
                                <Icon size={20} strokeWidth={1.75} />
                            </div>
                        )}

                        <div className="flex flex-col min-w-0">
                            <h1 className="text-[17px] font-semibold text-gray-900 leading-tight tracking-[-0.01em] truncate">
                                {title}
                            </h1>
                            {subtitle && (
                                <p className="text-[12px] text-gray-400 mt-0.5 leading-tight truncate">
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
            </div>

            {/* ── Page content ────────────────────────────────────────── */}
            <div className={`flex-1 ${noPadding ? '' : 'p-6'} ${className}`}>
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
