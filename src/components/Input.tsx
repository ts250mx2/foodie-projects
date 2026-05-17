import React from 'react';

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
    ...props
}: InputProps) {
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
                className={`w-full px-3 py-2 text-sm rounded-lg border transition-all duration-150
                    ${error
                        ? 'border-red-400 ring-2 ring-red-100 focus:border-red-500 focus:ring-red-100'
                        : 'border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
                    }
                    bg-white text-gray-800 placeholder:text-gray-400
                    focus:outline-none disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
                    ${className}`}
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

export function Select({ label, error, hint, className = '', id, children, ...props }: SelectProps) {
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
                className={`w-full px-3 py-2 text-sm rounded-lg border transition-all duration-150
                    ${error
                        ? 'border-red-400 ring-2 ring-red-100'
                        : 'border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
                    }
                    bg-white text-gray-800 focus:outline-none
                    disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
                    ${className}`}
                {...props}
            >
                {children}
            </select>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
        </div>
    );
}
