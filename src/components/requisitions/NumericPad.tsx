'use client';

import { useState } from 'react';
import { Delete, Check, X } from 'lucide-react';
import { INK, INK_MUTED, foregroundFor } from './theme';

interface NumericPadProps {
    title: string;
    subtitle?: string;
    unit?: string;
    accent: string;
    initialValue: number;
    onConfirm: (value: number) => void;
    onCancel: () => void;
}

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'del'] as const;

/**
 * Teclado numérico a pantalla completa. En una tablet de cocina el teclado del
 * sistema tapa media pantalla y obliga a apuntar con precisión; este tiene
 * teclas de 80px y vive dentro del flujo.
 */
export default function NumericPad({
    title, subtitle, unit, accent, initialValue, onConfirm, onCancel,
}: NumericPadProps) {
    // Arranca vacío: la primera tecla reemplaza el valor anterior en vez de
    // encadenarse a él, que es el error clásico al recapturar una cantidad.
    const [buffer, setBuffer] = useState('');

    const display = buffer || String(initialValue);
    const parsed = parseFloat(display);
    const isValid = Number.isFinite(parsed) && parsed > 0;
    const accentInk = foregroundFor(accent);

    const handleKey = (key: string) => {
        if (key === 'del') {
            setBuffer(prev => (prev ? prev.slice(0, -1) : ''));
            return;
        }
        if (key === '.' && buffer.includes('.')) return;
        if (buffer.replace('.', '').length >= 7) return;
        setBuffer(prev => prev + key);
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#eef1f5]">
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold leading-tight truncate" style={{ color: INK }}>{title}</h2>
                    {subtitle && <p className="text-sm font-medium mt-0.5 truncate" style={{ color: INK_MUTED }}>{subtitle}</p>}
                </div>
                <button
                    type="button"
                    onClick={onCancel}
                    className="shrink-0 h-14 w-14 rounded-2xl bg-white border-2 border-slate-300 flex items-center justify-center active:scale-95 transition"
                    style={{ color: INK }}
                    aria-label="Cancelar"
                >
                    <X size={26} strokeWidth={2.5} />
                </button>
            </div>

            <div className="mx-6 mb-5 rounded-3xl bg-white border-2 border-slate-300 px-6 py-6 flex items-baseline justify-end gap-3">
                <span className="text-6xl font-bold tabular-nums tracking-tight" style={{ color: INK }}>{display}</span>
                {unit && <span className="text-xl font-bold uppercase" style={{ color: INK_MUTED }}>{unit}</span>}
            </div>

            <div className="flex-1 grid grid-cols-3 gap-3 px-6 pb-4 min-h-0">
                {KEYS.map(key => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => handleKey(key)}
                        className="rounded-2xl bg-white border-2 border-slate-300 text-3xl font-bold flex items-center justify-center active:scale-95 active:bg-slate-100 transition select-none shadow-sm"
                        style={{ color: INK }}
                    >
                        {key === 'del' ? <Delete size={30} strokeWidth={2.5} /> : key}
                    </button>
                ))}
            </div>

            <div className="px-6 pb-6">
                <button
                    type="button"
                    disabled={!isValid}
                    onClick={() => onConfirm(parsed)}
                    className="w-full h-20 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 shadow-sm"
                    style={{ backgroundColor: accent, color: accentInk }}
                >
                    <Check size={26} strokeWidth={3} />
                    Confirmar cantidad
                </button>
            </div>
        </div>
    );
}
