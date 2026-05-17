'use client';

import { useEffect, useRef } from 'react';
import { X, Check, Ban } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import Button from './Button';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    size?: ModalSize;
    children: React.ReactNode;
    /** Reemplaza el footer completo si se necesita algo personalizado */
    footer?: React.ReactNode;
    onConfirm?: () => void;
    confirmLabel?: string;
    confirmLoading?: boolean;
    cancelLabel?: string;
    disableBackdropClose?: boolean;
    /** Variante del botón de confirmación */
    confirmVariant?: 'primary' | 'danger';
}

const SIZE_CLASSES: Record<ModalSize, string> = {
    sm:   'max-w-sm',
    md:   'max-w-lg',
    lg:   'max-w-2xl',
    xl:   'max-w-4xl',
    full: 'max-w-[95vw]',
};

export default function BaseModal({
    isOpen,
    onClose,
    title,
    subtitle,
    size = 'md',
    children,
    footer,
    onConfirm,
    confirmLabel    = 'Guardar',
    confirmLoading  = false,
    cancelLabel     = 'Cancelar',
    disableBackdropClose = false,
    confirmVariant  = 'primary',
}: BaseModalProps) {
    const { colors } = useTheme();
    const panelRef   = useRef<HTMLDivElement>(null);

    /* bloquear scroll */
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    /* cerrar con Escape */
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    /* footer por defecto: Cancel (secondary+iconBox) + Confirm (solid+iconBox) */
    const defaultFooter = onConfirm ? (
        <div className="flex items-center justify-end gap-2.5">
            <Button
                variant="secondary"
                size="md"
                leftIcon={Ban}
                iconBox
                onClick={onClose}
                disabled={confirmLoading}
            >
                {cancelLabel}
            </Button>
            <Button
                variant={confirmVariant === 'danger' ? 'danger' : 'solid'}
                size="md"
                leftIcon={confirmVariant === 'danger' ? undefined : Check}
                iconBox={confirmVariant !== 'danger'}
                onClick={onConfirm}
                isLoading={confirmLoading}
            >
                {confirmLabel}
            </Button>
        </div>
    ) : null;

    const resolvedFooter = footer ?? defaultFooter;

    return (
        <div
            className="fixed inset-0 z-[500] flex items-center justify-center p-4"
            aria-modal="true"
            role="dialog"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                onClick={disableBackdropClose ? undefined : onClose}
            />

            {/* Panel */}
            <div
                ref={panelRef}
                className={[
                    'relative w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden',
                    'animate-in zoom-in-95 fade-in duration-200',
                    SIZE_CLASSES[size],
                ].join(' ')}
                style={{ maxHeight: '90vh' }}
            >
                {/* ── Header ──────────────────────────────────────────── */}
                <div className="shrink-0 flex items-stretch border-b border-gray-100">

                    {/* Accent bar */}
                    <div
                        className="w-[3px] shrink-0"
                        style={{
                            background: `linear-gradient(to bottom, ${colors.colorFondo1}, ${colors.colorFondo2})`,
                        }}
                    />

                    {/* Title + close */}
                    <div className="flex-1 flex items-start justify-between px-5 py-4 gap-4 min-w-0">
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <h2 className="text-[15px] font-semibold text-gray-900 leading-tight truncate">
                                {title}
                            </h2>
                            {subtitle && (
                                <p className="text-[12px] text-gray-400 leading-tight">
                                    {subtitle}
                                </p>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            aria-label="Cerrar"
                            className="shrink-0 mt-0.5 p-1.5 rounded-lg text-gray-400
                                       hover:text-gray-700 hover:bg-gray-100
                                       active:scale-95 transition-all duration-100"
                        >
                            <X size={16} strokeWidth={2} />
                        </button>
                    </div>
                </div>

                {/* ── Body ────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="px-6 py-5">
                        {children}
                    </div>
                </div>

                {/* ── Footer ──────────────────────────────────────────── */}
                {resolvedFooter && (
                    <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/60">
                        {resolvedFooter}
                    </div>
                )}
            </div>
        </div>
    );
}
