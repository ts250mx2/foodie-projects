'use client';

import { useMemo, useState } from 'react';
import { Search, X, Hash, Plus } from 'lucide-react';
import { RequisitionProduct } from './types';
import { INK, INK_MUTED, foregroundFor } from './theme';
import { NO_AUTOFILL } from '@/components/noAutofill';

interface ProductGridProps {
    products: RequisitionProduct[];
    quantities: Map<number, number>;
    accent: string;
    /**
     * Categorías del perfil (IdCategoria; 0 = sin categoría). Vacío o null =
     * el perfil ve el catálogo completo sin separaciones.
     */
    allowedCategoryIds?: number[] | null;
    onAdd: (product: RequisitionProduct) => void;
    onOpenPad: (product: RequisitionProduct) => void;
}

const ALL_CATEGORIES = '__all__';

/** Insumos sin categoría: se agrupan bajo un id propio para poder asignarlos. */
const UNCATEGORIZED_ID = 0;
const UNCATEGORIZED_LABEL = 'Sin categoría';

type CategoryOption = { id: number; label: string };

const categoryIdOf = (product: RequisitionProduct) => product.IdCategoria ?? UNCATEGORIZED_ID;

/** Verde de "ya va en el pedido": 4.9:1 sobre blanco, legible como texto. */
const IN_CART = '#047857';
const IN_CART_WASH = '#ecfdf5';

/** Quita acentos para que "jitomate" encuentre "Jitomáte". */
function normalize(value: string): string {
    return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export default function ProductGrid({
    products,
    quantities,
    accent,
    allowedCategoryIds,
    onAdd,
    onOpenPad,
}: ProductGridProps) {
    const [search, setSearch] = useState('');
    // Arranca en "Todos", que con perfil acotado significa "todas las suyas".
    const [category, setCategory] = useState<string>(ALL_CATEGORIES);

    const accentInk = foregroundFor(accent);

    /**
     * Las categorías del perfil van al frente y las demás detrás, en su propio
     * espacio: la tablet no esconde nada, solo ordena por lo que a ese equipo
     * le toca pedir.
     */
    const { own, others, hasScope } = useMemo(() => {
        const byId = new Map<number, string>();
        products.forEach(p => {
            const id = categoryIdOf(p);
            if (!byId.has(id)) byId.set(id, p.Categoria || UNCATEGORIZED_LABEL);
        });

        const all: CategoryOption[] = [...byId.entries()]
            .map(([id, label]) => ({ id, label }))
            .sort((a, b) => a.label.localeCompare(b.label, 'es'));

        const scope = new Set(allowedCategoryIds ?? []);
        // Un perfil cuyas categorías ya no existen en el catálogo se trata como
        // sin configurar: mejor mostrarle todo que dejarlo sin nada que pedir.
        const scoped = all.filter(option => scope.has(option.id));
        if (scoped.length === 0) return { own: all, others: [] as CategoryOption[], hasScope: false };

        return { own: scoped, others: all.filter(option => !scope.has(option.id)), hasScope: true };
    }, [products, allowedCategoryIds]);

    const ownIds = useMemo(() => new Set(own.map(option => option.id)), [own]);

    /**
     * Coincidencias de la búsqueda que quedaron fuera del alcance del perfil.
     * Sin esto, buscar "servilleta" en Cocina no devuelve nada y parece que el
     * insumo no existe, cuando solo vive en otra área.
     */
    const outsideMatches = useMemo(() => {
        const term = normalize(search.trim());
        if (!hasScope || !term || category !== ALL_CATEGORIES) return [] as Array<CategoryOption & { count: number }>;

        const counts = new Map<number, { label: string; count: number }>();
        products.forEach(product => {
            const id = categoryIdOf(product);
            if (ownIds.has(id)) return;
            const matches =
                normalize(product.Producto).includes(term) ||
                normalize(product.Codigo || '').includes(term);
            if (!matches) return;
            const entry = counts.get(id);
            if (entry) entry.count += 1;
            else counts.set(id, { label: product.Categoria || UNCATEGORIZED_LABEL, count: 1 });
        });

        return [...counts.entries()]
            .map(([id, { label, count }]) => ({ id, label, count }))
            .sort((a, b) => b.count - a.count);
    }, [products, search, category, hasScope, ownIds]);

    const visible = useMemo(() => {
        const term = normalize(search.trim());
        return products.filter(product => {
            const id = categoryIdOf(product);
            // "Todos" respeta el alcance del perfil; una categoría concreta
            // manda sobre él (así se llega a lo de las otras áreas).
            if (category === ALL_CATEGORIES) {
                if (hasScope && !ownIds.has(id)) return false;
            } else if (String(id) !== category) {
                return false;
            }
            if (!term) return true;
            return (
                normalize(product.Producto).includes(term) ||
                normalize(product.Codigo || '').includes(term)
            );
        });
    }, [products, search, category, hasScope, ownIds]);

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
                        {...NO_AUTOFILL}
                        name="rq-q"
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

            <div className="flex items-center gap-2.5 overflow-x-auto px-4 pb-3 shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[{ id: ALL_CATEGORIES, label: hasScope ? 'Todos los míos' : 'Todos' },
                  ...own.map(option => ({ id: String(option.id), label: option.label }))
                ].map(option => {
                    const isActive = category === option.id;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => setCategory(option.id)}
                            className="h-14 px-6 rounded-full border-2 font-bold whitespace-nowrap shrink-0 transition active:scale-95"
                            style={{
                                backgroundColor: isActive ? accent : '#ffffff',
                                borderColor: isActive ? accent : '#cbd5e1',
                                color: isActive ? accentInk : INK,
                            }}
                        >
                            {option.label}
                        </button>
                    );
                })}

                {/* El espacio de las categorías que NO son de este perfil:
                    separadas y en gris, pero alcanzables de un toque. */}
                {others.length > 0 && (
                    <>
                        <span className="shrink-0 flex items-center gap-2.5 pl-2.5" aria-hidden="true">
                            <span className="h-10 w-0.5 rounded-full bg-slate-300" />
                        </span>
                        <span className="shrink-0 text-[13px] font-bold uppercase tracking-wide pr-1" style={{ color: INK_MUTED }}>
                            Otras áreas
                        </span>
                        {others.map(option => {
                            const isActive = category === String(option.id);
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setCategory(String(option.id))}
                                    className="h-14 px-6 rounded-full border-2 border-dashed font-bold whitespace-nowrap shrink-0 transition active:scale-95"
                                    style={{
                                        backgroundColor: isActive ? accent : '#f1f5f9',
                                        borderColor: isActive ? accent : '#cbd5e1',
                                        color: isActive ? accentInk : INK_MUTED,
                                    }}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 min-h-0">
                {outsideMatches.length > 0 && (
                    <div className="mb-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-3">
                        <p className="text-[15px] font-semibold" style={{ color: INK_MUTED }}>
                            También hay coincidencias en otras áreas:
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                            {outsideMatches.map(option => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setCategory(String(option.id))}
                                    className="h-12 px-5 rounded-full border-2 border-dashed border-slate-300 bg-slate-100 font-bold whitespace-nowrap transition active:scale-95"
                                    style={{ color: INK }}
                                >
                                    {option.label} · {option.count}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

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
