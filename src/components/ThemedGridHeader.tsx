'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { ReactNode } from 'react';

interface ThemedGridHeaderProps {
    children: ReactNode;
    className?: string;
}

export default function ThemedGridHeader({ children, className = '' }: ThemedGridHeaderProps) {
    const { colors } = useTheme();

    return (
        <thead>
            <tr
                style={{
                    background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`,
                    color: colors.colorLetra
                }}
                className={className}
            >
                {children}
            </tr>
        </thead>
    );
}

// Individual header cell component
interface ThemedGridHeaderCellProps {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
}

export function ThemedGridHeaderCell({ children, className = '', onClick }: ThemedGridHeaderCellProps) {
    const { colors } = useTheme();

    return (
        <th
            style={{ color: colors.colorLetra }}
            className={`px-4 py-3 text-left text-sm font-semibold uppercase tracking-wider ${className}`}
            onClick={onClick}
        >
            {children}
        </th>
    );
}
