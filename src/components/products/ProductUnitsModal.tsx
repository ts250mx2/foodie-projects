'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, Scale, Trash2, Wand2 } from 'lucide-react';
import BaseModal from '@/components/BaseModal';
import Button from '@/components/Button';
import { ProductUnit, conversionHint, normalizeUnit, validateUnits } from '@/lib/units';

/**
 * Presentaciones de un producto: en qué unidad se lleva el inventario y a
 * cuánto equivale cada empaque.
 *
 * La pantalla evita la palabra "factor": la persona llena la frase
 * "1 BOTE = 3700 GRAMO", que es como lo diría en voz alta. El factor sale de
 * ahí.
 */

interface Existencia {
    idSucursal: number;
    sucursal: string;
    existencia: number;
    costoPromedio: number;
    unidad: string | null;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    productId: number;
    productName: string;
    /** Se dispara tras guardar, por si la pantalla de atrás quiere refrescar. */
    onSaved?: () => void;
}

/** Renglón en edición: el factor viaja como texto para no pelear con el input. */
type EditRow = {
    key: number;
    unidad: string;
    equivale: string;
    esBase: boolean;
    esCompra: boolean;
    esPedido: boolean;
};

let rowSeq = 1;
const newRow = (partial: Partial<EditRow> = {}): EditRow => ({
    key: rowSeq++,
    unidad: '',
    equivale: '',
    esBase: false,
    esCompra: false,
    esPedido: false,
    ...partial,
});

const toRows = (units: ProductUnit[]): EditRow[] =>
    units.map(u => newRow({
        unidad: u.unidad,
        equivale: u.esBase ? '1' : String(u.factor),
        esBase: u.esBase,
        esCompra: u.esCompra,
        esPedido: u.esPedido,
    }));

const toUnits = (rows: EditRow[]): ProductUnit[] =>
    rows.map(r => ({
        unidad: normalizeUnit(r.unidad),
        factor: r.esBase ? 1 : Number(r.equivale),
        esBase: r.esBase,
        esCompra: r.esCompra,
        esPedido: r.esPedido,
    }));

export default function ProductUnitsModal({
    isOpen, onClose, projectId, productId, productName, onSaved,
}: Props) {
    const [rows, setRows] = useState<EditRow[]>([]);
    const [existencias, setExistencias] = useState<Existencia[]>([]);
    const [sugerencia, setSugerencia] = useState<ProductUnit[]>([]);
    const [catalogo, setCatalogo] = useState<string[]>([]);
    const [unidadOriginal, setUnidadOriginal] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/products/units?projectId=${projectId}&productId=${productId}`);
            const data = await res.json();
            if (!data.success) {
                setError(data.message || 'No se pudieron cargar las presentaciones.');
                return;
            }
            const units: ProductUnit[] = data.units || [];
            setRows(units.length > 0 ? toRows(units) : []);
            setExistencias(data.existencias || []);
            setSugerencia(data.sugerencia || []);
            setCatalogo(data.catalogoUnidades || []);
            setUnidadOriginal(units.find(u => u.esBase)?.unidad || data.producto?.unidadInventario || null);
        } catch {
            setError('No se pudieron cargar las presentaciones.');
        } finally {
            setIsLoading(false);
        }
    }, [projectId, productId]);

    useEffect(() => {
        if (isOpen) cargar();
    }, [isOpen, cargar]);

    const units = useMemo(() => toUnits(rows), [rows]);
    const base = rows.find(r => r.esBase) || null;
    const problema = rows.length > 0 ? validateUnits(units) : null;

    // Cambiar la unidad base con existencia viva deja el inventario en otra
    // escala: es el aviso más importante de esta pantalla.
    const baseCambio = Boolean(
        base && unidadOriginal && normalizeUnit(base.unidad) !== normalizeUnit(unidadOriginal)
    );
    const hayExistencia = existencias.some(e => e.existencia !== 0);

    const setRow = (key: number, patch: Partial<EditRow>) => {
        setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
    };

    /** La base, la de compra y la de pedido son exclusivas: marcarlas desmarca. */
    const setExclusivo = (key: number, campo: 'esBase' | 'esCompra' | 'esPedido', valor: boolean) => {
        setRows(prev => prev.map(r => {
            if (r.key === key) {
                const patch: Partial<EditRow> = { [campo]: valor };
                if (campo === 'esBase' && valor) patch.equivale = '1';
                return { ...r, ...patch };
            }
            return valor ? { ...r, [campo]: false } : r;
        }));
    };

    const agregar = () => {
        setRows(prev => prev.length === 0
            ? [newRow({ esBase: true, equivale: '1', esPedido: true })]
            : [...prev, newRow()]
        );
    };

    const aplicarSugerencia = () => {
        setRows(toRows(sugerencia));
        setSugerencia([]);
    };

    const guardar = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/products/units', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, productId, units }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.message || 'No se pudo guardar.');
                return;
            }
            onSaved?.();
            onClose();
        } catch {
            setError('No se pudo guardar.');
        } finally {
            setIsSaving(false);
        }
    };

    const ejemplo = base && normalizeUnit(base.unidad)
        ? conversionHint(units, 100, base.unidad)
        : null;

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Unidades y presentaciones"
            subtitle={productName}
            size="lg"
            onConfirm={guardar}
            confirmLabel="Guardar"
            confirmLoading={isSaving}
        >
            <datalist id="unidades-catalogo">
                {catalogo.map(u => <option key={u} value={u} />)}
            </datalist>

            {isLoading ? (
                <p className="text-sm py-8 text-center" style={{ color: '#6B7280' }}>Cargando…</p>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                        El almacén guarda existencia y costo en la <strong>unidad base</strong>.
                        Las demás presentaciones dicen a cuánto equivalen, para que puedas comprar
                        por bote y que te pidan por gramo sin descuadrar el inventario.
                    </p>

                    {rows.length === 0 && sugerencia.length > 0 && (
                        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 flex items-start gap-3">
                            <Wand2 size={18} className="mt-0.5 shrink-0" style={{ color: '#7C3AED' }} />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium" style={{ color: '#5B21B6' }}>
                                    Podemos partir de lo ya capturado
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: '#6D28D9' }}>
                                    {sugerencia.map(u => u.esBase
                                        ? `Base: ${u.unidad}`
                                        : `1 ${u.unidad} = ${u.factor} ${sugerencia.find(b => b.esBase)?.unidad || ''}`
                                    ).join(' · ')}
                                </p>
                                <Button variant="outline" size="sm" className="mt-2" onClick={aplicarSugerencia}>
                                    Usar esta propuesta
                                </Button>
                            </div>
                        </div>
                    )}

                    {rows.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
                            <Scale size={22} className="mx-auto mb-2" style={{ color: '#9CA3AF' }} />
                            <p className="text-sm" style={{ color: '#6B7280' }}>
                                Este producto no convierte unidades: se mueve tal como se captura.
                            </p>
                            <Button variant="outline" size="sm" leftIcon={Plus} className="mt-3" onClick={agregar}>
                                Definir unidad base
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {rows.map(row => (
                                <div
                                    key={row.key}
                                    className={`rounded-lg border p-3 ${row.esBase ? 'border-violet-300 bg-violet-50/50' : 'border-gray-200 bg-white'}`}
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        {row.esBase ? (
                                            <span
                                                className="text-xs font-semibold px-2 py-1 rounded-md bg-violet-100 shrink-0"
                                                style={{ color: '#5B21B6' }}
                                            >
                                                UNIDAD BASE
                                            </span>
                                        ) : (
                                            <span className="text-sm shrink-0" style={{ color: '#4B5563' }}>1</span>
                                        )}

                                        <input
                                            list="unidades-catalogo"
                                            value={row.unidad}
                                            onChange={e => setRow(row.key, { unidad: e.target.value.toUpperCase() })}
                                            placeholder={row.esBase ? 'GRAMO' : 'BOTE'}
                                            className="h-9 px-2 rounded-md border border-gray-300 text-sm w-32 min-w-0"
                                            style={{ color: '#111827' }}
                                        />

                                        {!row.esBase && (
                                            <>
                                                <span className="text-sm shrink-0" style={{ color: '#4B5563' }}>=</span>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    value={row.equivale}
                                                    onChange={e => setRow(row.key, { equivale: e.target.value })}
                                                    placeholder="3700"
                                                    className="h-9 px-2 rounded-md border border-gray-300 text-sm w-28 min-w-0"
                                                    style={{ color: '#111827' }}
                                                />
                                                <span className="text-sm font-medium shrink-0" style={{ color: '#4B5563' }}>
                                                    {base?.unidad || '—'}
                                                </span>
                                            </>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => setRows(prev => prev.filter(r => r.key !== row.key))}
                                            className="ml-auto p-1.5 rounded-md hover:bg-red-50 shrink-0"
                                            aria-label="Quitar presentación"
                                        >
                                            <Trash2 size={15} style={{ color: '#DC2626' }} />
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 mt-2 pl-1">
                                        {!row.esBase && (
                                            <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: '#4B5563' }}>
                                                <input
                                                    type="radio"
                                                    name="unidad-base"
                                                    checked={false}
                                                    onChange={() => setExclusivo(row.key, 'esBase', true)}
                                                />
                                                Hacer esta la base
                                            </label>
                                        )}
                                        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: '#4B5563' }}>
                                            <input
                                                type="checkbox"
                                                checked={row.esCompra}
                                                onChange={e => setExclusivo(row.key, 'esCompra', e.target.checked)}
                                            />
                                            Así lo compro
                                        </label>
                                        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: '#4B5563' }}>
                                            <input
                                                type="checkbox"
                                                checked={row.esPedido}
                                                onChange={e => setExclusivo(row.key, 'esPedido', e.target.checked)}
                                            />
                                            Así me lo piden
                                        </label>
                                    </div>
                                </div>
                            ))}

                            <Button variant="outline" size="sm" leftIcon={Plus} onClick={agregar}>
                                Agregar presentación
                            </Button>
                        </div>
                    )}

                    {ejemplo && (
                        <p className="text-xs" style={{ color: '#6B7280' }}>
                            Ejemplo: {ejemplo}
                        </p>
                    )}

                    {problema && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm" style={{ color: '#92400E' }}>
                            {problema}
                        </div>
                    )}

                    {baseCambio && hayExistencia && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-3">
                            <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: '#D97706' }} />
                            <div className="min-w-0">
                                <p className="text-sm font-medium" style={{ color: '#92400E' }}>
                                    Este producto ya tiene existencia registrada
                                </p>
                                <ul className="text-xs mt-1 space-y-0.5" style={{ color: '#92400E' }}>
                                    {existencias.map(e => (
                                        <li key={e.idSucursal}>
                                            {e.sucursal}: {e.existencia.toLocaleString('es-MX')} {e.unidad || ''} a $
                                            {e.costoPromedio.toFixed(4)}
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-xs mt-2" style={{ color: '#92400E' }}>
                                    Esa cantidad está en <strong>{unidadOriginal}</strong> y no se reconvierte sola.
                                    Después de guardar, ve a <strong>Compras → Almacén</strong> y captura la
                                    existencia real en <strong>{base?.unidad}</strong>. Los movimientos anteriores
                                    quedan como historia.
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm" style={{ color: '#B91C1C' }}>
                            {error}
                        </div>
                    )}
                </div>
            )}
        </BaseModal>
    );
}
