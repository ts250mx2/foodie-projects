import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
}

export default function Input({
    label,
    error,
    hint,
    className = '',
    id,
    style,
    ...props
}: InputProps) {
    const { colors } = useTheme();
    const [isFocused, setIsFocused] = React.useState(false);
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
        <div className="w-full flex flex-col gap-1">
            {label && (
                <label
                    htmlFor={inputId}
                    className="text-xs font-semibold text-gray-500 uppercase tracking-wide"
                >
                    {label}
                </label>
            )}
            <input
                id={inputId}
                onFocus={(e) => {
                    setIsFocused(true);
                    if (props.onFocus) props.onFocus(e);
                }}
                onBlur={(e) => {
                    setIsFocused(false);
                    if (props.onBlur) props.onBlur(e);
                }}
                className={`w-full text-sm rounded-lg border transition-all duration-150
                    bg-white text-gray-800 placeholder:text-gray-400
                    focus:outline-none disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
                    ${className}`}
                style={{
                    borderColor: error 
                        ? '#f87171' // border-red-400
                        : isFocused 
                            ? colors.colorFondo1 
                            : '#e5e7eb', // border-gray-200
                    borderWidth: isFocused ? '2px' : '1px',
                    paddingLeft: isFocused ? '11px' : '12px',
                    paddingRight: isFocused ? '11px' : '12px',
                    paddingTop: isFocused ? '7px' : '8px',
                    paddingBottom: isFocused ? '7px' : '8px',
                    boxShadow: 'none',
                    ...style
                }}
                {...props}
            />
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
        </div>
    );
}

/** Select con el mismo estilo que Input */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    hint?: string;
    children: React.ReactNode;
}

export function Select({ label, error, hint, className = '', id, children, style, ...props }: SelectProps) {
    const { colors } = useTheme();
    const [isFocused, setIsFocused] = React.useState(false);
    const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
        <div className="w-full flex flex-col gap-1">
            {label && (
                <label
                    htmlFor={selectId}
                    className="text-xs font-semibold text-gray-500 uppercase tracking-wide"
                >
                    {label}
                </label>
            )}
            <select
                id={selectId}
                onFocus={(e) => {
                    setIsFocused(true);
                    if (props.onFocus) props.onFocus(e);
                }}
                onBlur={(e) => {
                    setIsFocused(false);
                    if (props.onBlur) props.onBlur(e);
                }}
                className={`w-full text-sm rounded-lg border transition-all duration-150
                    bg-white text-gray-800 focus:outline-none
                    disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
                    ${className}`}
                style={{
                    borderColor: error 
                        ? '#f87171' // border-red-400
                        : isFocused 
                            ? colors.colorFondo1 
                            : '#e5e7eb', // border-gray-200
                    borderWidth: isFocused ? '2px' : '1px',
                    paddingLeft: isFocused ? '11px' : '12px',
                    paddingRight: isFocused ? '11px' : '12px',
                    paddingTop: isFocused ? '7px' : '8px',
                    paddingBottom: isFocused ? '7px' : '8px',
                    boxShadow: 'none',
                    ...style
                }}
                {...props}
            >
                {children}
            </select>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
        </div>
    );
}
