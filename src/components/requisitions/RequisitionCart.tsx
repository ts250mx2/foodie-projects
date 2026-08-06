'use client';

import { ArrowLeft, Minus, Plus, Send, Trash2 } from 'lucide-react';
import { CartLine } from './types';
import { INK, INK_MUTED, foregroundFor } from './theme';

interface RequisitionCartProps {
    lines: CartLine[];
    notas: string;
    accent: string;
    isSending: boolean;
    error: string | null;
    onBack: () => void;
    onChangeQty: (idProducto: number, cantidad: number) => void;
    onOpenPad: (idProducto: number) => void;
    onRemove: (idProducto: number) => void;
    onNotasChange: (value: string) => void;
    onSend: () => void;
}

/** Paso de revisión: ajustar cantidades y mandar. */
export default function RequisitionCart({
    lines,
    notas,
    accent,
    isSending,
    error,
    onBack,
    onChangeQty,
    onOpenPad,
    onRemove,
    onNotasChange,
    onSend,
}: RequisitionCartProps) {
    const totalUnidades = lines.reduce((sum, line) => sum + line.cantidad, 0);
    const accentInk = foregroundFor(accent);

    return (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#eef1f5]">
            <header className="flex items-center gap-3 px-4 py-4 border-b-2 border-slate-300 bg-white shrink-0">
                <button
                    type="button"
                    onClick={onBack}
                    className="h-14 w-14 rounded-2xl bg-white border-2 border-slate-300 flex items-center justify-center active:scale-95 transition"
                    style={{ color: INK }}
                    aria-label="Volver al catálogo"
                >
                    <ArrowLeft size={24} strokeWidth={2.5} />
                </button>
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold leading-tight" style={{ color: INK }}>Revisar pedido</h2>
                    <p className="text-sm font-semibold" style={{ color: INK_MUTED }}>
                        {lines.length} {lines.length === 1 ? 'insumo' : 'insumos'} · {totalUnidades.toLocaleString('es-MX')} unidades
                    </p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
                <ul className="space-y-3">
                    {lines.map(({ producto, cantidad }) => (
                        <li
                            key={producto.IdProducto}
                            className="rounded-2xl bg-white border-2 border-slate-300 p-4 flex items-center gap-4 flex-wrap shadow-sm"
                        >
                            <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                                <p className="text-lg font-bold leading-snug" style={{ color: INK }}>{producto.Producto}</p>
                                <p className="text-[13px] font-bold uppercase tracking-wide mt-0.5" style={{ color: INK_MUTED }}>
                                    {producto.Unidad}
                                    {producto.Codigo && <span className="ml-2 normal-case font-semibold">{producto.Codigo}</span>}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 ml-auto">
                                <button
                                    type="button"
                                    onClick={() => onChangeQty(producto.IdProducto, Math.max(0, cantidad - 1))}
                                    className="h-16 w-16 rounded-2xl bg-white border-2 border-slate-400 flex items-center justify-center active:scale-95 active:bg-slate-100 transition"
                                    style={{ color: INK }}
                                    aria-label={`Quitar uno de ${producto.Producto}`}
                                >
                                    <Minus size={24} strokeWidth={3} />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => onOpenPad(producto.IdProducto)}
                                    className="h-16 min-w-24 px-4 rounded-2xl bg-white border-2 border-slate-900 text-2xl font-bold tabular-nums active:scale-95 transition"
                                    style={{ color: INK }}
                                >
                                    {cantidad}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => onChangeQty(producto.IdProducto, cantidad + 1)}
                                    className="h-16 w-16 rounded-2xl border-2 flex items-center justify-center active:scale-95 transition"
                                    style={{ backgroundColor: accent, borderColor: accent, color: accentInk }}
                                    aria-label={`Agregar uno de ${producto.Producto}`}
                                >
                                    <Plus size={24} strokeWidth={3} />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => onRemove(producto.IdProducto)}
                                    className="h-16 w-16 rounded-2xl bg-white border-2 flex items-center justify-center active:scale-95 transition"
                                    style={{ borderColor: '#fca5a5', color: '#b91c1c' }}
                                    aria-label={`Eliminar ${producto.Producto}`}
                                >
                                    <Trash2 size={22} strokeWidth={2.5} />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>

                <div className="mt-6">
                    <label
                        htmlFor="notas"
                        className="block text-[13px] font-bold uppercase tracking-wide mb-2"
                        style={{ color: INK_MUTED }}
                    >
                        Nota para compras (opcional)
                    </label>
                    <textarea
                        id="notas"
                        value={notas}
                        onChange={e => onNotasChange(e.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder="Ej. urge para el servicio de la noche"
                        className="w-full rounded-2xl bg-white border-2 border-slate-300 px-5 py-4 text-lg font-medium outline-none focus:border-slate-900 transition resize-none placeholder:text-slate-500"
                        style={{ color: INK }}
                    />
                </div>
            </div>

            <div className="px-4 pb-6 pt-3 border-t-2 border-slate-300 bg-white shrink-0">
                {error && (
                    <p
                        className="mb-3 rounded-xl px-4 py-3 font-bold border-2"
                        style={{ backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }}
                    >
                        {error}
                    </p>
                )}
                <button
                    type="button"
                    disabled={isSending || lines.length === 0}
                    onClick={onSend}
                    className="w-full h-20 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 shadow-sm"
                    style={{ backgroundColor: accent, color: accentInk }}
                >
                    <Send size={24} strokeWidth={2.5} />
                    {isSending ? 'Enviando…' : 'Enviar requisición'}
                </button>
            </div>
        </div>
    );
}
