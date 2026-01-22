'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline';
    isLoading?: boolean;
    children: React.ReactNode;
}

export default function Button({
    variant = 'primary',
    isLoading = false,
    children,
    className = '',
    disabled,
    ...props
}: ButtonProps) {
    const { colors } = useTheme();
    const baseStyles = 'px-6 py-3 rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';

    // For primary variant, use custom colors
    const getPrimaryStyles = () => ({
        background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`,
        color: colors.colorLetra
    });

    const variantStyles = {
        primary: 'shadow-lg hover:shadow-xl transform hover:-translate-y-0.5',
        secondary: 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5',
        outline: 'border-2 hover:bg-opacity-10',
    };

    const getOutlineStyles = () => ({
        borderColor: colors.colorFondo1,
        color: colors.colorFondo1
    });

    return (
        <button
            className={`${baseStyles} ${variantStyles[variant]} ${className}`}
            disabled={disabled || isLoading}
            style={variant === 'primary' ? getPrimaryStyles() : variant === 'outline' ? getOutlineStyles() : undefined}
            {...props}
        >
            {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cargando...
                </span>
            ) : (
                children
            )}
        </button>
    );
}
