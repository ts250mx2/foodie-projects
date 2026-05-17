'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { ReactNode } from 'react';
import { ChevronsUpDown, ChevronUp, ChevronDown, PackageOpen } from 'lucide-react';
import React from 'react';

/* ── ThemedGridHeader ──────────────────────────────────────────────────────
   Header profesional sin gradiente. Fondo gris muy claro, texto muted,
   acento de marca solo en los indicadores de ordenamiento.
────────────────────────────────────────────────────────────────────────── */

interface ThemedGridHeaderProps {
    children: ReactNode;
    className?: string;
}

export default function ThemedGridHeader({ children, className = '' }: ThemedGridHeaderProps) {
    const { colors } = useTheme();

    return (
        <thead className="sticky top-0 z-10 shadow-sm">
            <tr
                className={className}
                style={{ backgroundColor: colors.colorFondo1 }}
            >
                {children}
            </tr>
        </thead>
    );
}

/* ── ThemedGridHeaderCell ─────────────────────────────────────────────────
   Celdas de cabecera: cuadradas (sin border-radius), texto gris oscuro.
   Los indicadores de sort usan el color de marca.
────────────────────────────────────────────────────────────────────────── */

interface ThemedGridHeaderCellProps {
    children?: ReactNode;
    className?: string;
    onClick?: () => void;
    style?: React.CSSProperties;
    sortable?: boolean;
    sortDir?: 'asc' | 'desc' | null;
    align?: 'left' | 'center' | 'right';
}

export function ThemedGridHeaderCell({
    children,
    className = '',
    onClick,
    style,
    sortable = false,
    sortDir,
    align = 'left',
}: ThemedGridHeaderCellProps) {
    const { colors } = useTheme();

    const alignClass = {
        left:   'text-left',
        center: 'text-center',
        right:  'text-right',
    }[align];

    /* Ícono de sort — blanco sobre fondo primario */
    function SortIcon() {
        if (sortDir === 'asc')  return <ChevronUp  size={12} className="text-white" />;
        if (sortDir === 'desc') return <ChevronDown size={12} className="text-white" />;
        return <ChevronsUpDown size={11} className="text-white/40" />;
    }

    return (
        <th
            onClick={onClick}
            style={{ color: colors.colorLetra, ...style }}
            className={[
                'px-4 py-3',
                'text-[11px] font-semibold uppercase tracking-wider',
                'whitespace-nowrap select-none',
                alignClass,
                sortable
                    ? 'cursor-pointer hover:brightness-110 transition-all duration-100'
                    : '',
                className,
            ].join(' ')}
        >
            {sortable ? (
                <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                    {children}
                    <SortIcon />
                </span>
            ) : (
                children
            )}
        </th>
    );
}

/* ── TableBody ─────────────────────────────────────────────────────────────
   tbody con skeleton loading y empty state integrados.
────────────────────────────────────────────────────────────────────────── */

interface TableBodyProps {
    children?: ReactNode;
    loading?: boolean;
    empty?: boolean;
    emptyMessage?: string;
    colSpan?: number;
}

export function TableBody({
    children,
    loading,
    empty,
    emptyMessage = 'Sin registros',
    colSpan = 6,
}: TableBodyProps) {
    /* Skeleton loading */
    if (loading) {
        return (
            <tbody>
                {[...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                        {[...Array(colSpan)].map((_, j) => (
                            <td key={j} className="px-4 py-3">
                                <div
                                    className="h-[14px] bg-gray-100 rounded animate-pulse"
                                    style={{ width: `${55 + ((i * 3 + j * 7) % 35)}%` }}
                                />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        );
    }

    /* Empty state */
    if (empty) {
        return (
            <tbody>
                <tr>
                    <td colSpan={colSpan} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                                <PackageOpen size={22} className="text-gray-300" />
                            </div>
                            <p className="text-sm text-gray-400 font-medium">{emptyMessage}</p>
                        </div>
                    </td>
                </tr>
            </tbody>
        );
    }

    return (
        <tbody className="divide-y divide-gray-100 bg-white">
            {children}
        </tbody>
    );
}

/* ── TableRow ──────────────────────────────────────────────────────────────
   Filas cuadradas (sin border-radius). Hover neutro muy sutil.
────────────────────────────────────────────────────────────────────────── */

interface TableRowProps {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
    selected?: boolean;
}

export function TableRow({ children, onClick, className = '', selected }: TableRowProps) {
    return (
        <tr
            onClick={onClick}
            className={[
                'transition-colors duration-75',
                selected ? 'bg-blue-50/60' : 'bg-white hover:bg-gray-50/80',
                onClick ? 'cursor-pointer' : '',
                className,
            ].join(' ')}
        >
            {children}
        </tr>
    );
}

/* ── TableCell ─────────────────────────────────────────────────────────────
   Celda estándar. padding compacto, sin border-radius.
────────────────────────────────────────────────────────────────────────── */

interface TableCellProps {
    children?: ReactNode;
    className?: string;
    align?: 'left' | 'center' | 'right';
    muted?: boolean;
}

export function TableCell({
    children,
    className = '',
    align = 'left',
    muted = false,
}: TableCellProps) {
    const alignClass = {
        left:   'text-left',
        center: 'text-center',
        right:  'text-right',
    }[align];

    return (
        <td className={[
            'px-4 py-2.5 text-[13px] leading-snug',
            'tabular',                              /* numerales tabulares */
            muted ? 'text-gray-400' : 'text-gray-700',
            alignClass,
            className,
        ].join(' ')}>
            {children}
        </td>
    );
}

/* ── RowActionButton ───────────────────────────────────────────────────────
   Botones de acción en filas. Cuadrado redondeado (rounded-md).
   Se muestran siempre pero con poco contraste; al hover se destacan.
────────────────────────────────────────────────────────────────────────── */

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ElementType;
    label: string;
    variant?: 'edit' | 'delete' | 'view' | 'default';
}

export function RowActionButton({
    icon: Icon,
    label,
    variant = 'default',
    className = '',
    ...props
}: ActionButtonProps) {
    const variantClass = {
        edit:    'text-gray-300 hover:text-blue-600  hover:bg-blue-50',
        delete:  'text-gray-300 hover:text-red-500   hover:bg-red-50',
        view:    'text-gray-300 hover:text-violet-600 hover:bg-violet-50',
        default: 'text-gray-300 hover:text-gray-700  hover:bg-gray-100',
    }[variant];

    return (
        <button
            title={label}
            aria-label={label}
            className={[
                'p-1.5 rounded-md transition-all duration-100',
                variantClass,
                className,
            ].join(' ')}
            {...props}
        >
            <Icon size={14} strokeWidth={2} />
        </button>
    );
}
