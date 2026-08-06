'use client';

import { useMemo, useState } from 'react';
import { Search, X, Hash, Plus } from 'lucide-react';
import { RequisitionProduct } from './types';
import { INK, INK_MUTED, foregroundFor } from './theme';

interface ProductGridProps {
    products: RequisitionProduct[];
    quantities: Map<number, number>;
    accent: string;
    onAdd: (product: RequisitionProduct) => void;
    onOpenPad: (product: RequisitionProduct) => void;
}

const ALL_CATEGORIES = '__all__';

/** Verde de "ya va en el pedido": 4.9:1 sobre blanco, legible como texto. */
const IN_CART = '#047857';
const IN_CART_WASH = '#ecfdf5';

/** Quita acentos para que "jitomate" encuentre "Jitomáte". */
function normalize(value: string): string {
    return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export default function ProductGrid({ products, quantities, accent, onAdd, onOpenPad }: ProductGridProps) {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<string>(ALL_CATEGORIES);

    const accentInk = foregroundFor(accent);

    const categories = useMemo(() => {
        const unique = new Set<string>();
        products.forEach(p => unique.add(p.Categoria || 'Sin categoría'));
        return [...unique].sort((a, b) => a.localeCompare(b, 'es'));
    }, [products]);

    const visible = useMemo(() => {
        const term = normalize(search.trim());
        return products.filter(product => {
            const productCategory = product.Categoria || 'Sin categoría';
            if (category !== ALL_CATEGORIES && productCategory !== category) return false;
            if (!term) return true;
            return (
                normalize(product.Producto).includes(term) ||
                normalize(product.Codigo || '').includes(term)
            );
        });
    }, [products, search, category]);

    return (
        <div className="flex flex-col min-h-0 flex-1">
            <div className="px-4 pt-4 pb-3 shrink-0">
                <div className="relative">
                    <Search size={22} className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: INK_MUTED }} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar insumo…"
                        autoComplete="off"
                        className="w-full h-16 rounded-2xl bg-white border-2 border-slate-300 pl-14 pr-14 text-lg font-medium outline-none focus:border-slate-900 transition placeholder:text-slate-500"
                        style={{ color: INK }}
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center active:scale-95 transition"
                            style={{ color: INK }}
                            aria-label="Limpiar búsqueda"
                        >
                            <X size={20} strokeWidth={2.5} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex gap-2.5 overflow-x-auto px-4 pb-3 shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[ALL_CATEGORIES, ...categories].map(option => {
                    const isActive = category === option;
                    const label = option === ALL_CATEGORIES ? 'Todos' : option;
                    return (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setCategory(option)}
                            className="h-14 px-6 rounded-full border-2 font-bold whitespace-nowrap shrink-0 transition active:scale-95"
                            style={{
                                backgroundColor: isActive ? accent : '#ffffff',
                                borderColor: isActive ? accent : '#cbd5e1',
                                color: isActive ? accentInk : INK,
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 min-h-0">
                {visible.length === 0 ? (
                    <p className="text-center py-16 text-lg font-medium" style={{ color: INK_MUTED }}>
                        No hay insumos que coincidan.
                    </p>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {visible.map(product => {
                            const inCart = quantities.get(product.IdProducto) ?? 0;
                            const isActive = inCart > 0;
                            return (
                                <div
                                    key={product.IdProducto}
                                    className="relative rounded-2xl border-2 overflow-hidden bg-white shadow-sm transition"
                                    style={{
                                        backgroundColor: isActive ? IN_CART_WASH : '#ffffff',
                                        borderColor: isActive ? IN_CART : '#cbd5e1',
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onAdd(product)}
                                        className="w-full text-left px-4 pt-4 pb-3 min-h-[124px] flex flex-col active:scale-[0.97] transition"
                                    >
                                        <span
                                            className="text-[17px] font-bold leading-snug line-clamp-3 pr-9"
                                            style={{ color: INK }}
                                        >
                                            {product.Producto}
                                        </span>
                                        <span
                                            className="mt-auto pt-2 text-[13px] font-bold uppercase tracking-wide"
                                            style={{ color: INK_MUTED }}
                                        >
                                            {product.Unidad}
                                        </span>
                                    </button>

                                    <div className="flex items-stretch border-t-2" style={{ borderColor: '#e2e8f0' }}>
                                        <button
                                            type="button"
                                            onClick={() => onOpenPad(product)}
                                            className="flex-1 h-12 flex items-center justify-center gap-1.5 active:bg-slate-100 transition"
                                            style={{ color: INK_MUTED }}
                                            aria-label={`Capturar cantidad de ${product.Producto}`}
                                        >
                                            <Hash size={16} strokeWidth={2.5} />
                                            <span className="text-[13px] font-bold uppercase tracking-wide">Cantidad</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onAdd(product)}
                                            className="w-16 h-12 flex items-center justify-center border-l-2 transition active:brightness-90"
                                            style={{ borderColor: '#e2e8f0', backgroundColor: accent, color: accentInk }}
                                            aria-label={`Agregar uno de ${product.Producto}`}
                                        >
                                            <Plus size={22} strokeWidth={3} />
                                        </button>
                                    </div>

                                    {isActive && (
                                        <span
                                            className="absolute top-2.5 right-2.5 min-w-9 h-9 px-2 rounded-full text-sm font-bold flex items-center justify-center tabular-nums shadow"
                                            style={{ backgroundColor: IN_CART, color: '#ffffff' }}
                                        >
                                            {inCart}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
