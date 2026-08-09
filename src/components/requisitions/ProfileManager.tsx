'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, KeyRound, Pencil, Plus, Trash2, X, ShieldOff } from 'lucide-react';
import Button from '@/components/Button';

export interface RequisitionProfile {
    IdPerfil: number;
    IdSucursal: number;
    Perfil: string;
    /** MySQL devuelve el booleano como 0/1. */
    TienePin: number;
}

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface ProfileManagerProps {
    projectId: number | null;
    accentColor: string;
}

type Draft = { idPerfil: number; nombre: string } | null;
type PinDraft = { idPerfil: number; nombre: string; pin: string } | null;

/**
 * Perfiles con los que el personal firma sus requisiciones desde la tablet.
 *
 * El PIN es opcional y se guarda hasheado, así que no se puede consultar: si se
 * olvida, se reemplaza. Eso es a propósito — es un secreto compartido que la
 * gente suele reutilizar.
 */
export default function ProfileManager({ projectId, accentColor }: ProfileManagerProps) {
    const [profiles, setProfiles] = useState<RequisitionProfile[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    // Sucursal cuyos perfiles se están administrando. Con una sola, se fija sola.
    const [idSucursal, setIdSucursal] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [nuevoNombre, setNuevoNombre] = useState('');
    const [renaming, setRenaming] = useState<Draft>(null);
    const [pinDraft, setPinDraft] = useState<PinDraft>(null);

    const load = useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        try {
            const [perfilesRes, sucursalesRes] = await Promise.all([
                fetch(`/api/requisitions/profiles?projectId=${projectId}`, { cache: 'no-store' }),
                fetch(`/api/branches?projectId=${projectId}`, { cache: 'no-store' }),
            ]);
            const perfilesData = await perfilesRes.json();
            const sucursalesData = await sucursalesRes.json();

            if (perfilesData.success) setProfiles(perfilesData.data || []);
            else setError(perfilesData.message || 'No se pudieron cargar los perfiles');

            if (sucursalesData.success) {
                const lista: Branch[] = sucursalesData.data || [];
                setBranches(lista);
                // Con una sola sucursal no hay nada que elegir: queda fija.
                setIdSucursal(prev => prev ?? (lista.length > 0 ? lista[0].IdSucursal : null));
            }
        } catch {
            setError('No se pudieron cargar los perfiles');
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    const perfilesDeSucursal = profiles.filter(p => p.IdSucursal === idSucursal);

    /** Envuelve una llamada al API y recarga la lista al terminar bien. */
    const run = async (input: RequestInfo, init?: RequestInit) => {
        setError(null);
        try {
            const res = await fetch(input, init);
            const data = await res.json();
            if (!data.success) { setError(data.message || 'No se pudo completar la acción'); return false; }
            await load();
            return true;
        } catch {
            setError('No se pudo completar la acción');
            return false;
        }
    };

    const crear = async () => {
        if (!nuevoNombre.trim()) return;
        const ok = await run('/api/requisitions/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, idSucursal, perfil: nuevoNombre.trim() }),
        });
        if (ok) setNuevoNombre('');
    };

    const renombrar = async () => {
        if (!renaming || !renaming.nombre.trim()) return;
        const ok = await run('/api/requisitions/profiles', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, idPerfil: renaming.idPerfil, perfil: renaming.nombre.trim() }),
        });
        if (ok) setRenaming(null);
    };

    const guardarPin = async () => {
        if (!pinDraft) return;
        const ok = await run('/api/requisitions/profiles', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, idPerfil: pinDraft.idPerfil, pin: pinDraft.pin || null }),
        });
        if (ok) setPinDraft(null);
    };

    const quitarPin = async (profile: RequisitionProfile) => {
        await run('/api/requisitions/profiles', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, idPerfil: profile.IdPerfil, pin: null }),
        });
    };

    const eliminar = async (profile: RequisitionProfile) => {
        const confirmado = window.confirm(
            `¿Eliminar el perfil "${profile.Perfil}"?\n\nLas requisiciones ya levantadas con ese nombre no se tocan.`
        );
        if (!confirmado) return;
        await run(`/api/requisitions/profiles?projectId=${projectId}&idPerfil=${profile.IdPerfil}`, { method: 'DELETE' });
    };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Perfiles de captura
                </p>
                {isLoading && <span className="text-[10px] text-gray-400">cargando…</span>}
            </div>

            {/* Los perfiles son por sucursal. Con una sola no se muestra el
                selector: no habría nada que elegir. */}
            {branches.length > 1 && (
                <div className="flex gap-1.5 flex-wrap mb-2">
                    {branches.map(branch => {
                        const isActive = idSucursal === branch.IdSucursal;
                        return (
                            <button
                                key={branch.IdSucursal}
                                type="button"
                                onClick={() => setIdSucursal(branch.IdSucursal)}
                                className="h-8 px-3 rounded-md text-[11px] font-bold border-2 transition-colors"
                                style={{
                                    backgroundColor: isActive ? accentColor : '#ffffff',
                                    borderColor: isActive ? accentColor : '#e5e7eb',
                                    color: isActive ? '#ffffff' : '#6b7280',
                                }}
                            >
                                {branch.Sucursal}
                            </button>
                        );
                    })}
                </div>
            )}

            {error && (
                <p className="mb-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium">
                    {error}
                </p>
            )}

            <ul className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {perfilesDeSucursal.length === 0 && !isLoading && (
                    <li className="px-3 py-4 text-center text-xs text-gray-500">
                        Sin perfiles. Crea el primero abajo.
                    </li>
                )}

                {perfilesDeSucursal.map(profile => {
                    const editando = renaming?.idPerfil === profile.IdPerfil;
                    const cambiandoPin = pinDraft?.idPerfil === profile.IdPerfil;

                    return (
                        <li key={profile.IdPerfil} className="px-3 py-2.5 bg-white">
                            {editando ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        value={renaming!.nombre}
                                        onChange={e => setRenaming({ ...renaming!, nombre: e.target.value })}
                                        onKeyDown={e => { if (e.key === 'Enter') renombrar(); if (e.key === 'Escape') setRenaming(null); }}
                                        autoFocus
                                        maxLength={60}
                                        className="flex-1 h-9 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-gray-900"
                                    />
                                    <button type="button" onClick={renombrar} className="h-9 w-9 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: accentColor }} title="Guardar">
                                        <Check size={16} strokeWidth={3} />
                                    </button>
                                    <button type="button" onClick={() => setRenaming(null)} className="h-9 w-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500" title="Cancelar">
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : cambiandoPin ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        value={pinDraft!.pin}
                                        onChange={e => setPinDraft({ ...pinDraft!, pin: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                                        onKeyDown={e => { if (e.key === 'Enter') guardarPin(); if (e.key === 'Escape') setPinDraft(null); }}
                                        autoFocus
                                        inputMode="numeric"
                                        placeholder={`PIN de ${pinDraft!.nombre} (4 a 8 dígitos)`}
                                        className="flex-1 h-9 rounded-lg border border-gray-300 px-3 text-sm tracking-widest outline-none focus:border-gray-900"
                                    />
                                    <button type="button" onClick={guardarPin} className="h-9 w-9 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: accentColor }} title="Guardar PIN">
                                        <Check size={16} strokeWidth={3} />
                                    </button>
                                    <button type="button" onClick={() => setPinDraft(null)} className="h-9 w-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500" title="Cancelar">
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                        <span className="block text-sm font-semibold text-gray-900 truncate">{profile.Perfil}</span>
                                        <span className="block text-[11px] font-medium" style={{ color: profile.TienePin ? '#047857' : '#9ca3af' }}>
                                            {profile.TienePin ? 'Con PIN' : 'Sin PIN'}
                                        </span>
                                    </div>

                                    <button type="button" onClick={() => setRenaming({ idPerfil: profile.IdPerfil, nombre: profile.Perfil })}
                                        className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors" title="Cambiar nombre">
                                        <Pencil size={14} />
                                    </button>
                                    <button type="button" onClick={() => setPinDraft({ idPerfil: profile.IdPerfil, nombre: profile.Perfil, pin: '' })}
                                        className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors"
                                        title={profile.TienePin ? 'Cambiar PIN' : 'Poner PIN'}>
                                        <KeyRound size={14} />
                                    </button>
                                    {Boolean(profile.TienePin) && (
                                        <button type="button" onClick={() => quitarPin(profile)}
                                            className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-amber-600 hover:border-amber-200 transition-colors" title="Quitar PIN">
                                            <ShieldOff size={14} />
                                        </button>
                                    )}
                                    <button type="button" onClick={() => eliminar(profile)}
                                        className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-red-600 hover:border-red-200 transition-colors" title="Eliminar perfil">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            <div className="flex items-center gap-2 mt-2.5">
                <input
                    value={nuevoNombre}
                    onChange={e => setNuevoNombre(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') crear(); }}
                    placeholder="Nuevo perfil (ej. Panadería)"
                    maxLength={60}
                    className="flex-1 h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-gray-900"
                />
                <Button leftIcon={Plus} onClick={crear} size="sm" variant="secondary" disabled={!nuevoNombre.trim()}>
                    Agregar
                </Button>
            </div>

            <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                El PIN se guarda cifrado y no se puede consultar: si se olvida, se reemplaza. Sirve para que el pedido
                quede firmado por quien lo levanta, no como contraseña — la liga de la tablet sigue siendo pública.
            </p>
        </div>
    );
}
