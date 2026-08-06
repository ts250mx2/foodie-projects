'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, ClipboardList, Loader2, LockKeyhole, Pencil, ShoppingCart } from 'lucide-react';
import IdentityGate from '@/components/requisitions/IdentityGate';
import NumericPad from '@/components/requisitions/NumericPad';
import ProductGrid from '@/components/requisitions/ProductGrid';
import RequisitionCart from '@/components/requisitions/RequisitionCart';
import { INK, INK_MUTED, accentTextOn, foregroundFor } from '@/components/requisitions/theme';
import {
    CartLine,
    Requester,
    RequisitionBranch,
    RequisitionProduct,
    RequisitionTheme,
} from '@/components/requisitions/types';

type Stage = 'loading' | 'invalid' | 'identity' | 'catalog' | 'review' | 'sent';

/** Verde de marca por defecto cuando el proyecto no definió color. */
const FALLBACK_ACCENT = '#16a34a';

export default function RequisitionPage() {
    const params = useParams();
    const uuid = (params?.uuid as string) || '';

    const [stage, setStage] = useState<Stage>('loading');
    const [theme, setTheme] = useState<RequisitionTheme | null>(null);
    const [branches, setBranches] = useState<RequisitionBranch[]>([]);
    const [products, setProducts] = useState<RequisitionProduct[]>([]);

    const [requester, setRequester] = useState<Requester | null>(null);
    const [quantities, setQuantities] = useState<Map<number, number>>(new Map());
    const [notas, setNotas] = useState('');
    const [padTarget, setPadTarget] = useState<RequisitionProduct | null>(null);

    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [folio, setFolio] = useState<number | null>(null);

    const storageKey = `requisicion:${uuid}`;

    useEffect(() => {
        if (!uuid) { setStage('invalid'); return; }

        let cancelled = false;
        const controller = new AbortController();

        fetch(`/api/requisitions/session?uuid=${encodeURIComponent(uuid)}`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
                if (cancelled) return;
                if (!data.success) { setStage('invalid'); return; }

                setTheme(data.project);
                setBranches(data.branches || []);
                setProducts(data.products || []);

                // La tablet recuerda quién pidió la última vez para no volver a
                // capturar sucursal y nombre en cada pedido del turno.
                let saved: Requester | null = null;
                try {
                    const raw = localStorage.getItem(storageKey);
                    if (raw) saved = JSON.parse(raw);
                } catch { /* almacenamiento no disponible */ }

                const branchStillActive =
                    saved && (data.branches || []).some((b: RequisitionBranch) => b.IdSucursal === saved!.idSucursal);

                if (saved && branchStillActive) {
                    setRequester(saved);
                    setStage('catalog');
                } else {
                    setStage('identity');
                }
            })
            .catch(err => {
                if (cancelled || err.name === 'AbortError') return;
                setStage('invalid');
            });

        return () => { cancelled = true; controller.abort(); };
    }, [uuid, storageKey]);

    const productsById = useMemo(() => {
        const map = new Map<number, RequisitionProduct>();
        products.forEach(p => map.set(p.IdProducto, p));
        return map;
    }, [products]);

    const lines = useMemo<CartLine[]>(() => {
        const result: CartLine[] = [];
        quantities.forEach((cantidad, idProducto) => {
            const producto = productsById.get(idProducto);
            if (producto && cantidad > 0) result.push({ producto, cantidad });
        });
        return result.sort((a, b) => a.producto.Producto.localeCompare(b.producto.Producto, 'es'));
    }, [quantities, productsById]);

    const setQuantity = useCallback((idProducto: number, cantidad: number) => {
        setQuantities(prev => {
            const next = new Map(prev);
            if (cantidad > 0) next.set(idProducto, cantidad);
            else next.delete(idProducto);
            return next;
        });
    }, []);

    const handleAdd = useCallback((product: RequisitionProduct) => {
        setQuantities(prev => {
            const next = new Map(prev);
            next.set(product.IdProducto, (prev.get(product.IdProducto) ?? 0) + 1);
            return next;
        });
    }, []);

    const handleConfirmRequester = (value: Requester) => {
        setRequester(value);
        try {
            localStorage.setItem(storageKey, JSON.stringify(value));
        } catch { /* almacenamiento no disponible */ }
        setStage('catalog');
    };

    const handleSend = async () => {
        if (!requester || lines.length === 0) return;

        setIsSending(true);
        setError(null);
        try {
            const res = await fetch('/api/requisitions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uuid,
                    idSucursal: requester.idSucursal,
                    solicitante: requester.solicitante,
                    area: requester.area,
                    notas,
                    items: lines.map(line => ({
                        idProducto: line.producto.IdProducto,
                        cantidad: line.cantidad,
                        unidadMedida: line.producto.Unidad,
                    })),
                }),
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.message || 'No se pudo enviar la requisición');
                return;
            }

            setFolio(data.folio);
            setQuantities(new Map());
            setNotas('');
            setStage('sent');
        } catch {
            setError('Sin conexión. Revisa la red e intenta de nuevo.');
        } finally {
            setIsSending(false);
        }
    };

    // El color de marca se usa como relleno de botón; la tinta de encima se
    // calcula para que un morado saturado no acabe con texto negro ilegible.
    const accent = theme?.colorFondo1 || FALLBACK_ACCENT;
    const accentInk = foregroundFor(accent);
    const accentOnLight = accentTextOn(accent);

    const branchName = branches.find(b => b.IdSucursal === requester?.idSucursal)?.Sucursal ?? '';
    const totalUnidades = lines.reduce((sum, line) => sum + line.cantidad, 0);

    if (stage === 'loading') {
        return (
            <main className="min-h-dvh bg-[#eef1f5] flex flex-col items-center justify-center gap-4" style={{ color: INK_MUTED }}>
                <Loader2 size={40} className="animate-spin" />
                <p className="text-lg font-semibold">Cargando catálogo…</p>
            </main>
        );
    }

    if (stage === 'invalid') {
        return (
            <main className="min-h-dvh bg-[#eef1f5] flex flex-col items-center justify-center gap-4 px-8 text-center">
                <LockKeyhole size={52} style={{ color: INK_MUTED }} />
                <h1 className="text-2xl font-bold" style={{ color: INK }}>Liga no válida</h1>
                <p className="max-w-md font-medium" style={{ color: INK_MUTED }}>
                    Esta liga de requisiciones no existe o fue revocada. Pídele al administrador el código QR actualizado.
                </p>
            </main>
        );
    }

    if (stage === 'sent') {
        return (
            <main className="min-h-dvh bg-[#eef1f5] flex flex-col items-center justify-center gap-6 px-8 text-center">
                <CheckCircle2 size={72} style={{ color: accentOnLight }} />
                <div>
                    <h1 className="text-3xl font-bold" style={{ color: INK }}>Requisición enviada</h1>
                    <p className="mt-2 text-lg font-semibold" style={{ color: INK_MUTED }}>
                        Folio <span className="font-bold tabular-nums" style={{ color: INK }}>#{folio}</span> · quedó pendiente de surtir
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => { setFolio(null); setStage('catalog'); }}
                    className="h-20 px-10 rounded-2xl font-bold text-xl active:scale-[0.98] transition shadow-sm"
                    style={{ backgroundColor: accent, color: accentInk }}
                >
                    Levantar otra requisición
                </button>
            </main>
        );
    }

    if (stage === 'identity') {
        return (
            <main className="min-h-dvh bg-[#eef1f5]">
                <IdentityGate
                    branches={branches}
                    accent={accent}
                    initial={requester}
                    onConfirm={handleConfirmRequester}
                />
            </main>
        );
    }

    return (
        <main className="h-dvh bg-[#eef1f5] flex flex-col overflow-hidden">
            <header className="flex items-center gap-3 px-4 py-3 border-b-2 border-slate-300 bg-white shrink-0">
                {theme?.logo64 && (
                    <img
                        src={theme.logo64}
                        alt=""
                        className="h-12 w-12 rounded-xl object-cover border-2 border-slate-200 shrink-0"
                    />
                )}
                <div className="min-w-0 flex-1">
                    <h1 className="text-lg font-bold leading-tight truncate" style={{ color: INK }}>{theme?.titulo}</h1>
                    <p className="text-[13px] font-semibold truncate" style={{ color: INK_MUTED }}>
                        {branchName} · {requester?.area} · {requester?.solicitante}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setStage('identity')}
                    className="h-14 w-14 rounded-2xl bg-white border-2 border-slate-300 flex items-center justify-center active:scale-95 transition shrink-0"
                    style={{ color: INK }}
                    aria-label="Cambiar sucursal o solicitante"
                >
                    <Pencil size={20} strokeWidth={2.5} />
                </button>
            </header>

            {products.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center" style={{ color: INK_MUTED }}>
                    <ClipboardList size={44} />
                    <p className="text-lg font-semibold">Este proyecto no tiene insumos dados de alta.</p>
                </div>
            ) : (
                <ProductGrid
                    products={products}
                    quantities={quantities}
                    accent={accent}
                    onAdd={handleAdd}
                    onOpenPad={setPadTarget}
                />
            )}

            <div className="px-4 pb-5 pt-3 border-t-2 border-slate-300 bg-white shrink-0">
                <button
                    type="button"
                    disabled={lines.length === 0}
                    onClick={() => { setError(null); setStage('review'); }}
                    className="w-full h-20 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 shadow-sm"
                    style={{ backgroundColor: accent, color: accentInk }}
                >
                    <ShoppingCart size={24} strokeWidth={2.5} />
                    {lines.length === 0
                        ? 'Toca un insumo para empezar'
                        : `Revisar pedido · ${lines.length} ${lines.length === 1 ? 'insumo' : 'insumos'} · ${totalUnidades.toLocaleString('es-MX')} u`}
                </button>
            </div>

            {stage === 'review' && (
                <RequisitionCart
                    lines={lines}
                    notas={notas}
                    accent={accent}
                    isSending={isSending}
                    error={error}
                    onBack={() => setStage('catalog')}
                    onChangeQty={setQuantity}
                    onOpenPad={id => {
                        const product = productsById.get(id);
                        if (product) setPadTarget(product);
                    }}
                    onRemove={id => setQuantity(id, 0)}
                    onNotasChange={setNotas}
                    onSend={handleSend}
                />
            )}

            {padTarget && (
                <NumericPad
                    title={padTarget.Producto}
                    subtitle={padTarget.Categoria || undefined}
                    unit={padTarget.Unidad}
                    accent={accent}
                    initialValue={quantities.get(padTarget.IdProducto) ?? 0}
                    onCancel={() => setPadTarget(null)}
                    onConfirm={value => {
                        setQuantity(padTarget.IdProducto, value);
                        setPadTarget(null);
                    }}
                />
            )}
        </main>
    );
}
