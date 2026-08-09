'use client';

import { useState } from 'react';
import { ArrowRight, KeyRound, Store, UserRound } from 'lucide-react';
import { RequisitionBranch, RequisitionProfile, Requester } from './types';
import { INK, INK_MUTED, foregroundFor } from './theme';
import { NO_AUTOFILL } from '@/components/noAutofill';

interface IdentityGateProps {
    branches: RequisitionBranch[];
    profiles: RequisitionProfile[];
    accent: string;
    initial: Requester | null;
    /** Verifica el PIN contra el servidor. El PIN nunca se compara aquí. */
    onVerifyPin: (idPerfil: number, pin: string) => Promise<boolean>;
    onConfirm: (requester: Requester, pin: string) => void;
}

/**
 * Primera pantalla: sucursal, perfil y quién pide. No es un login — firma la
 * requisición para que en el portal se sepa a quién preguntarle.
 *
 * Los perfiles se configuran desde el portal y pueden llevar PIN. Se recuerda
 * la selección en la tablet, pero el PIN se vuelve a pedir siempre: guardarlo
 * anularía su propósito en un equipo compartido.
 */
export default function IdentityGate({
    branches, profiles, accent, initial, onVerifyPin, onConfirm,
}: IdentityGateProps) {
    const [idSucursal, setIdSucursal] = useState<number | null>(
        initial?.idSucursal ?? (branches.length === 1 ? branches[0].IdSucursal : null)
    );
    const [idPerfil, setIdPerfil] = useState<number | null>(() => {
        if (initial?.idPerfil) return initial.idPerfil;
        // Con una sola sucursal ya viene elegida, así que si además tiene un
        // único perfil se preselecciona también.
        const soloSucursal = branches.length === 1 ? branches[0].IdSucursal : initial?.idSucursal;
        const suyos = profiles.filter(p => p.IdSucursal === soloSucursal);
        return suyos.length === 1 ? suyos[0].IdPerfil : null;
    });
    const [solicitante, setSolicitante] = useState(initial?.solicitante || '');
    const [pin, setPin] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const accentInk = foregroundFor(accent);
    // Los perfiles son por sucursal: solo se ofrecen los de la elegida.
    const perfilesDeSucursal = profiles.filter(p => p.IdSucursal === idSucursal);
    const perfil = perfilesDeSucursal.find(p => p.IdPerfil === idPerfil) ?? null;
    const requierePin = Boolean(perfil?.TienePin);

    /** Cambiar de sucursal invalida el perfil y el PIN capturados. */
    const seleccionarSucursal = (id: number) => {
        setIdSucursal(id);
        const suyos = profiles.filter(p => p.IdSucursal === id);
        setIdPerfil(suyos.length === 1 ? suyos[0].IdPerfil : null);
        setPin('');
        setError(null);
    };

    const canContinue =
        idSucursal !== null &&
        perfil !== null &&
        solicitante.trim().length >= 2 &&
        (!requierePin || pin.length >= 4) &&
        !isChecking;

    const handleSubmit = async () => {
        if (!canContinue || !perfil) return;
        setError(null);

        if (requierePin) {
            setIsChecking(true);
            const ok = await onVerifyPin(perfil.IdPerfil, pin);
            setIsChecking(false);
            if (!ok) {
                setError('PIN incorrecto');
                setPin('');
                return;
            }
        }

        onConfirm(
            {
                idSucursal: idSucursal!,
                idPerfil: perfil.IdPerfil,
                area: perfil.Perfil,
                solicitante: solicitante.trim(),
            },
            pin
        );
    };

    return (
        <div className="min-h-dvh flex flex-col px-6 py-8 max-w-3xl mx-auto w-full">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight" style={{ color: INK }}>Nueva requisición</h1>
                <p className="mt-1 font-medium" style={{ color: INK_MUTED }}>Dinos desde dónde pides para arrancar.</p>
            </header>

            <section className="mb-8">
                <label className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide mb-3" style={{ color: INK_MUTED }}>
                    <Store size={15} strokeWidth={2.5} /> Sucursal
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {branches.map(branch => {
                        const isActive = idSucursal === branch.IdSucursal;
                        return (
                            <button
                                key={branch.IdSucursal}
                                type="button"
                                onClick={() => seleccionarSucursal(branch.IdSucursal)}
                                className="h-20 rounded-2xl border-2 px-5 text-left text-lg font-bold transition active:scale-[0.98] shadow-sm"
                                style={{
                                    backgroundColor: isActive ? accent : '#ffffff',
                                    borderColor: isActive ? accent : '#cbd5e1',
                                    color: isActive ? accentInk : INK,
                                }}
                            >
                                {branch.Sucursal}
                            </button>
                        );
                    })}
                </div>
                {branches.length === 0 && (
                    <p className="font-semibold" style={{ color: '#b45309' }}>Este proyecto no tiene sucursales activas.</p>
                )}
            </section>

            <section className="mb-8">
                <span className="block text-[13px] font-bold uppercase tracking-wide mb-3" style={{ color: INK_MUTED }}>
                    Perfil
                </span>
                <div className="flex flex-wrap gap-2.5">
                    {perfilesDeSucursal.map(option => {
                        const isActive = idPerfil === option.IdPerfil;
                        return (
                            <button
                                key={option.IdPerfil}
                                type="button"
                                onClick={() => { setIdPerfil(option.IdPerfil); setPin(''); setError(null); }}
                                className="h-14 px-6 rounded-full border-2 font-bold transition active:scale-95 flex items-center gap-2"
                                style={{
                                    backgroundColor: isActive ? accent : '#ffffff',
                                    borderColor: isActive ? accent : '#cbd5e1',
                                    color: isActive ? accentInk : INK,
                                }}
                            >
                                {Boolean(option.TienePin) && <KeyRound size={14} strokeWidth={2.5} />}
                                {option.Perfil}
                            </button>
                        );
                    })}
                </div>
                {idSucursal === null && (
                    <p className="font-semibold" style={{ color: INK_MUTED }}>Elige primero la sucursal.</p>
                )}
                {idSucursal !== null && perfilesDeSucursal.length === 0 && (
                    <p className="font-semibold" style={{ color: '#b45309' }}>
                        Esta sucursal no tiene perfiles. Pídele al administrador que los cree.
                    </p>
                )}
            </section>

            {requierePin && (
                <section className="mb-8">
                    <label htmlFor="pin" className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide mb-3" style={{ color: INK_MUTED }}>
                        <KeyRound size={15} strokeWidth={2.5} /> PIN de {perfil?.Perfil}
                    </label>
                    <input
                        id="pin"
                        type="password"
                        inputMode="numeric"
                        value={pin}
                        onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 8)); setError(null); }}
                        placeholder="••••"
                        {...NO_AUTOFILL}
                        name="rq-p"
                        className="w-full h-20 rounded-2xl bg-white border-2 px-6 text-2xl tracking-[0.5em] font-bold outline-none focus:border-slate-900 transition placeholder:text-slate-400 placeholder:tracking-normal"
                        style={{ color: INK, borderColor: error ? '#dc2626' : '#cbd5e1' }}
                    />
                    {error && <p className="mt-2 font-bold" style={{ color: '#dc2626' }}>{error}</p>}
                </section>
            )}

            <section className="mb-10">
                <label htmlFor="solicitante" className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide mb-3" style={{ color: INK_MUTED }}>
                    <UserRound size={15} strokeWidth={2.5} /> ¿Quién pide?
                </label>
                <input
                    id="solicitante"
                    type="text"
                    value={solicitante}
                    onChange={e => setSolicitante(e.target.value)}
                    placeholder="Nombre de quien solicita"
                    {...NO_AUTOFILL}
                    autoCapitalize="words"
                    name="rq-f1"
                    className="w-full h-20 rounded-2xl bg-white border-2 border-slate-300 px-6 text-xl font-medium outline-none focus:border-slate-900 transition placeholder:text-slate-500"
                    style={{ color: INK }}
                />
            </section>

            <button
                type="button"
                disabled={!canContinue}
                onClick={handleSubmit}
                className="mt-auto w-full h-20 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 shadow-sm"
                style={{ backgroundColor: accent, color: accentInk }}
            >
                {isChecking ? 'Verificando…' : 'Continuar al catálogo'}
                {!isChecking && <ArrowRight size={26} strokeWidth={3} />}
            </button>
        </div>
    );
}
