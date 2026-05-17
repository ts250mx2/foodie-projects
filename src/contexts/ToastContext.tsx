'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextValue {
    toast: (message: string, type?: ToastType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const STYLES = {
    success: 'bg-emerald-50 border-emerald-400 text-emerald-800',
    error: 'bg-red-50 border-red-400 text-red-800',
    warning: 'bg-amber-50 border-amber-400 text-amber-800',
    info: 'bg-blue-50 border-blue-400 text-blue-800',
};

const ICON_STYLES = {
    success: 'text-emerald-500',
    error: 'text-red-500',
    warning: 'text-amber-500',
    info: 'text-blue-500',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    const Icon = ICONS[toast.type];

    return (
        <div
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg max-w-sm w-full animate-in slide-in-from-right-5 fade-in duration-300 ${STYLES[toast.type]}`}
            role="alert"
        >
            <Icon size={18} className={`mt-0.5 shrink-0 ${ICON_STYLES[toast.type]}`} />
            <p className="text-sm font-medium flex-1 leading-snug">{toast.message}</p>
            <button
                onClick={() => onRemove(toast.id)}
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                aria-label="Cerrar"
            >
                <X size={15} />
            </button>
        </div>
    );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const counterRef = useRef(0);

    const remove = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const add = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
        const id = `toast-${++counterRef.current}`;
        setToasts(prev => [...prev, { id, type, message, duration }]);
        setTimeout(() => remove(id), duration);
    }, [remove]);

    const ctx: ToastContextValue = {
        toast: add,
        success: (msg, dur) => add(msg, 'success', dur),
        error: (msg, dur) => add(msg, 'error', dur),
        warning: (msg, dur) => add(msg, 'warning', dur),
        info: (msg, dur) => add(msg, 'info', dur),
    };

    return (
        <ToastContext.Provider value={ctx}>
            {children}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className="pointer-events-auto">
                        <ToastItem toast={t} onRemove={remove} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside ToastProvider');
    return ctx;
}
