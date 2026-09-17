'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Plus, Search, Trash2 } from 'lucide-react';
import BaseModal from '@/components/BaseModal';
import Button from '@/components/Button';

/**
 * Zonas de conteo de una sucursal y qué insumos se cuentan en cada una.
 *
 * La asignación es lo que hace rápido el inventario: en la cámara fría solo
 * aparece lo que de verdad está en la cámara. Un insumo puede estar en varias
 * zonas — el aceite vive en cocina y en almacén — y ahí está la gracia: el
 * total del producto es la suma de lo contado en cada una.
 *
 * Un producto que no esté asignado a NINGUNA zona aparece en TODAS, para que
 * un olvido de configuración no deje insumos sin contar.
 */

interface Zona {
    idZona: number;
    zona: string;
    orden: number;
    productos: number;
}

interface Producto {
    IdProducto: number;
    Producto: string;
    Codigo?: string;
    Categoria?: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    branchId: number;
    branchName?: string;
    /** Se dispara al cerrar si algo cambió, para refrescar la barra de zonas. */
    onChanged?: () => void;
}

export default function ZonesModal({ isOpen, onClose, projectId, branchId, branchName, onChanged }: Props) {
    const [zonas, setZonas] = useState<Zona[]>([]);
    const [productos, setProductos] = useState<Producto[]>([]);
    const [seleccionada, setSeleccionada] = useState<number | null>(null);
    const [asignados, setAsignados] = useState<Set<number>>(new Set());
    const [nuevaZona, setNuevaZona] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [huboCambios, setHuboCambios] = useState(false);

    const cargarZonas = useCallback(async () => {
        try {
            const res = await fetch(`/api/inventories/zones?projectId=${projectId}&branchId=${branchId}`);
            const data = await res.json();
            setZonas(data.success ? data.zonas : []);
        } catch {
            setError('No se pudieron cargar las zonas.');
        }
    }, [projectId, branchId]);

    const cargarProductos = useCallback(async () => {
        try {
            const res = await fetch(`/api/products?projectId=${projectId}&tipoProducto=0`);
            const data = await res.json();
            setProductos(data.success ? data.data : []);
        } catch {
            setError('No se pudieron cargar los insumos.');
        }
    }, [projectId]);

    useEffect(() => {
        if (!isOpen) return;
        setIsLoading(true);
        Promise.all([cargarZonas(), cargarProductos()]).finally(() => setIsLoading(false));
    }, [isOpen, cargarZonas, cargarProductos]);

    /** Al elegir zona se traen sus productos asignados. */
    const elegirZona = async (idZona: number) => {
        setSeleccionada(idZona);
        setBusqueda('');
        try {
            const res = await fetch(`/api/inventories/zones?projectId=${projectId}&zoneId=${idZona}`);
            const data = await res.json();
            setAsignados(new Set<number>(data.success ? data.productos : []));
        } catch {
            setAsignados(new Set());
        }
    };

    const crearZona = async () => {
        const zona = nuevaZona.trim();
        if (!zona) return;
        setIsSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/inventories/zones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, branchId, zona }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.message || 'No se pudo crear la zona.');
                return;
            }
            setNuevaZona('');
            setHuboCambios(true);
            await cargarZonas();
            await elegirZona(data.idZona);
        } catch {
            setError('No se pudo crear la zona.');
        } finally {
            setIsSaving(false);
        }
    };

    const eliminarZona = async (idZona: number) => {
        setIsSaving(true);
        try {
            await fetch(`/api/inventories/zones?projectId=${projectId}&zoneId=${idZona}`, { method: 'DELETE' });
            if (seleccionada === idZona) setSeleccionada(null);
            setHuboCambios(true);
            await cargarZonas();
        } catch {
            setError('No se pudo eliminar la zona.');
        } finally {
            setIsSaving(false);
        }
    };

    const guardarAsignacion = async () => {
        if (seleccionada === null) return;
        setIsSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/inventories/zones', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, idZona: seleccionada, productos: [...asignados] }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.message || 'No se pudo guardar.');
                return;
            }
            setHuboCambios(true);
            await cargarZonas();
        } catch {
            setError('No se pudo guardar.');
        } finally {
            setIsSaving(false);
        }
    };

    const alternar = (idProducto: number) => {
        setAsignados(prev => {
            const next = new Set(prev);
            if (next.has(idProducto)) next.delete(idProducto);
            else next.add(idProducto);
            return next;
        });
    };

    const cerrar = () => {
        if (huboCambios) onChanged?.();
        onClose();
    };

    const filtrados = productos.filter(p => {
        const q = busqueda.toLowerCase();
        return !q
            || (p.Producto || '').toLowerCase().includes(q)
            || (p.Codigo || '').toLowerCase().includes(q)
            || (p.Categoria || '').toLowerCase().includes(q);
    });

    const zonaActual = zonas.find(z => z.idZona === seleccionada);

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={cerrar}
            title="Zonas de conteo"
            subtitle={branchName}
            size="xl"
            footer={
                <div className="flex items-center justify-between gap-3 w-full">
                    <span className="text-xs" style={{ color: '#6B7280' }}>
                        Un insumo sin zona aparece en todas, para que nada se quede sin contar.
                    </span>
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={cerrar}>Cerrar</Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={guardarAsignacion}
                            isLoading={isSaving}
                            disabled={seleccionada === null}
                        >
                            Guardar insumos de la zona
                        </Button>
                    </div>
                </div>
            }
        >
            {isLoading ? (
                <p className="text-sm py-8 text-center" style={{ color: '#6B7280' }}>Cargando…</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 min-h-[380px]">
                    {/* Zonas */}
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <input
                                value={nuevaZona}
                                onChange={e => setNuevaZona(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') crearZona(); }}
                                placeholder="Cámara fría"
                                maxLength={60}
                                className="flex-1 min-w-0 h-9 px-2 rounded-md border border-gray-300 text-sm"
                                style={{ color: '#111827' }}
                            />
                            <Button variant="outline" size="sm" leftIcon={Plus} onClick={crearZona} disabled={!nuevaZona.trim()}>
                                Crear
                            </Button>
                        </div>

                        {zonas.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-gray-300 p-5 text-center">
                                <MapPin size={20} className="mx-auto mb-2" style={{ color: '#9CA3AF' }} />
                                <p className="text-xs" style={{ color: '#6B7280' }}>
                                    Sin zonas, el inventario se captura como hasta ahora.
                                </p>
                            </div>
                        ) : (
                            <ul className="space-y-1">
                                {zonas.map(z => (
                                    <li key={z.idZona}>
                                        <div
                                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${seleccionada === z.idZona ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white'}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => elegirZona(z.idZona)}
                                                className="flex-1 min-w-0 text-left"
                                            >
                                                <span className="block text-sm font-bold truncate" style={{ color: seleccionada === z.idZona ? '#5B21B6' : '#1F2937' }}>
                                                    {z.zona}
                                                </span>
                                                <span className="block text-[11px]" style={{ color: '#6B7280' }}>
                                                    {z.productos === 0 ? 'Sin insumos asignados' : `${z.productos} insumos`}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => eliminarZona(z.idZona)}
                                                className="p-1.5 rounded-md hover:bg-red-50 shrink-0"
                                                aria-label={`Eliminar ${z.zona}`}
                                            >
                                                <Trash2 size={14} style={{ color: '#DC2626' }} />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Insumos de la zona elegida */}
                    <div className="min-w-0">
                        {seleccionada === null ? (
                            <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-gray-300 p-6">
                                <p className="text-sm text-center" style={{ color: '#6B7280' }}>
                                    Elige una zona para marcar qué insumos se cuentan ahí.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1 min-w-0">
                                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                                        <input
                                            value={busqueda}
                                            onChange={e => setBusqueda(e.target.value)}
                                            placeholder="Buscar insumo…"
                                            className="w-full h-9 pl-8 pr-2 rounded-md border border-gray-300 text-sm"
                                            style={{ color: '#111827' }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold shrink-0" style={{ color: '#5B21B6' }}>
                                        {asignados.size} en {zonaActual?.zona}
                                    </span>
                                </div>

                                <div className="max-h-[320px] overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                                    {filtrados.map(p => (
                                        <label
                                            key={p.IdProducto}
                                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={asignados.has(p.IdProducto)}
                                                onChange={() => alternar(p.IdProducto)}
                                            />
                                            <span className="text-sm truncate min-w-0 flex-1" style={{ color: '#1F2937' }}>
                                                {p.Producto}
                                            </span>
                                            {p.Categoria && (
                                                <span className="text-[11px] shrink-0" style={{ color: '#9CA3AF' }}>
                                                    {p.Categoria}
                                                </span>
                                            )}
                                        </label>
                                    ))}
                                    {filtrados.length === 0 && (
                                        <p className="text-sm px-3 py-6 text-center" style={{ color: '#6B7280' }}>
                                            Sin resultados.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm" style={{ color: '#B91C1C' }}>
                    {error}
                </div>
            )}
        </BaseModal>
    );
}
