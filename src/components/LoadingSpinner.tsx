'use client';

interface LoadingSpinnerProps {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
    fullHeight?: boolean;
    className?: string;
}

export default function LoadingSpinner({
    message = 'Cargando...',
    size = 'md',
    fullHeight = false,
    className = ''
}: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12'
    };

    const paddingClasses = {
        sm: 'py-4',
        md: 'py-8',
        lg: 'py-12'
    };

    const containerClasses = fullHeight ? 'h-full' : '';

    return (
        <div className={`flex flex-col items-center justify-center gap-3 text-gray-400 ${paddingClasses[size]} ${containerClasses} ${className}`}>
            {/* Spinner */}
            <div className={`${sizeClasses[size]} border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin`} />

            {/* Message */}
            {message && (
                <p className="text-sm font-medium">{message}</p>
            )}
        </div>
    );
}
