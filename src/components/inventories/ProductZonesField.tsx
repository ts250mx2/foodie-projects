'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, MapPin } from 'lucide-react';

/**
 * Áreas de conteo a las que pertenece un producto, dentro de su ficha.
 *
 * No aparece si el proyecto no tiene zonas configuradas: quien no cuenta por
 * áreas no tiene por qué ver el campo. Tampoco aparece para productos nuevos,
 * porque la asignación necesita el id que todavía no existe.
 *
 * Guarda al momento de marcar, no con el botón del formulario: es una relación
 * aparte del producto y engancharla al guardado general obligaría a tocar los
 * tres caminos de alta que tiene el modal de costeo.
 */

interface ZonaSucursal {
    idSucursal: number;
    sucursal: string;
    zonas: { idZona: number; zona: string; asignada: boolean }[];
}

interface Props {
    projectId: number;
    /** 0 cuando el producto aún no se guarda. */
    productId: number;
}

export default function ProductZonesField({ projectId, productId }: Props) {
    const [sucursales, setSucursales] = useState<ZonaSucursal[]>([]);
    const [hayZonas, setHayZonas] = useState(false);
    const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/inventories/zones/product?projectId=${projectId}&productId=${productId || 0}`);
            const data = await res.json();
            if (!data.success) return;
            setSucursales(data.sucursales || []);
            setHayZonas(Boolean(data.hayZonas));
            setSeleccionadas(new Set<number>(
                (data.sucursales as ZonaSucursal[] || [])
                    .flatMap(s => s.zonas.filter(z => z.asignada).map(z => z.idZona))
            ));
        } catch {
            setError('No se pudieron cargar las áreas.');
        } finally {
            setIsLoading(false);
        }
    }, [projectId, productId]);

    useEffect(() => { cargar(); }, [cargar]);

    const alternar = async (idZona: number) => {
        const next = new Set(seleccionadas);
        if (next.has(idZona)) next.delete(idZona);
        else next.add(idZona);
        setSeleccionadas(next);

        setIsSaving(true);
        setError(null);
        setGuardado(false);
        try {
            const res = await fetch('/api/inventories/zones/product', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, productId, zonas: [...next] }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.message || 'No se pudo guardar.');
                // Se revierte para no mostrar una marca que no quedó guardada.
                setSeleccionadas(seleccionadas);
                return;
            }
            setGuardado(true);
            setTimeout(() => setGuardado(false), 1800);
        } catch {
            setError('No se pudo guardar.');
            setSeleccionadas(seleccionadas);
        } finally {
            setIsSaving(false);
        }
    };

    // Sin zonas en el proyecto no hay nada que configurar.
    if (isLoading || !hayZonas) return null;

    return (
        <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
            <div className="flex items-center gap-2 mb-2">
                <MapPin size={15} style={{ color: '#7C3AED' }} />
                <span className="text-sm font-bold" style={{ color: '#1F2937' }}>
                    Áreas de conteo
                </span>
                {isSaving && <Loader2 size={13} className="animate-spin" style={{ color: '#7C3AED' }} />}
                {guardado && !isSaving && (
                    <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: '#15803D' }}>
                        <Check size={12} /> Guardado
                    </span>
                )}
            </div>

            {!productId ? (
                <p className="text-xs" style={{ color: '#6B7280' }}>
                    Guarda el producto y podrás elegir en qué áreas se cuenta.
                </p>
            ) : (
                <>
                    <p className="text-xs mb-2.5" style={{ color: '#6B7280' }}>
                        Dónde se cuenta este producto al levantar inventario. Puede estar en varias
                        —lo que se cuente en cada una se suma. Sin marcar ninguna, aparece en todas.
                    </p>

                    <div className="space-y-2.5">
                        {sucursales.map(s => (
                            <div key={s.idSucursal}>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: '#9CA3AF' }}>
                                    {s.sucursal}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {s.zonas.map(z => {
                                        const activa = seleccionadas.has(z.idZona);
                                        return (
                                            <button
                                                key={z.idZona}
                                                type="button"
                                                onClick={() => alternar(z.idZona)}
                                                className={`h-8 px-3 rounded-lg border text-xs font-bold transition-colors ${activa
                                                    ? 'border-violet-300 bg-violet-100'
                                                    : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                                                style={{ color: activa ? '#5B21B6' : '#4B5563' }}
                                            >
                                                {z.zona}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {error && (
                <p className="text-xs mt-2" style={{ color: '#B91C1C' }}>{error}</p>
            )}
        </div>
    );
}
