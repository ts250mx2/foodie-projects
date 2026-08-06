'use client';

import { useState } from 'react';
import { ArrowRight, Store, UserRound } from 'lucide-react';
import { REQUISITION_AREAS, RequisitionBranch, Requester } from './types';
import { INK, INK_MUTED, foregroundFor } from './theme';

interface IdentityGateProps {
    branches: RequisitionBranch[];
    accent: string;
    initial: Requester | null;
    onConfirm: (requester: Requester) => void;
}

/**
 * Primera pantalla: sucursal, área y quién pide. No es un login — solo firma la
 * requisición para que en el portal se sepa a quién preguntarle. Se recuerda en
 * la tablet, así que en el uso diario se pasa de largo con un toque.
 */
export default function IdentityGate({ branches, accent, initial, onConfirm }: IdentityGateProps) {
    const [idSucursal, setIdSucursal] = useState<number | null>(
        initial?.idSucursal ?? (branches.length === 1 ? branches[0].IdSucursal : null)
    );
    const [area, setArea] = useState(initial?.area || 'Cocina');
    const [solicitante, setSolicitante] = useState(initial?.solicitante || '');

    const accentInk = foregroundFor(accent);
    const canContinue = idSucursal !== null && solicitante.trim().length >= 2;

    const handleSubmit = () => {
        if (!canContinue) return;
        onConfirm({ idSucursal: idSucursal!, area, solicitante: solicitante.trim() });
    };

    return (
        <div className="min-h-dvh flex flex-col px-6 py-8 max-w-3xl mx-auto w-full">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight" style={{ color: INK }}>Nueva requisición</h1>
                <p className="mt-1 font-medium" style={{ color: INK_MUTED }}>Dinos desde dónde pides para arrancar.</p>
            </header>

            <section className="mb-8">
                <label
                    className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide mb-3"
                    style={{ color: INK_MUTED }}
                >
                    <Store size={15} strokeWidth={2.5} /> Sucursal
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {branches.map(branch => {
                        const isActive = idSucursal === branch.IdSucursal;
                        return (
                            <button
                                key={branch.IdSucursal}
                                type="button"
                                onClick={() => setIdSucursal(branch.IdSucursal)}
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
                    <p className="font-semibold" style={{ color: '#b45309' }}>
                        Este proyecto no tiene sucursales activas.
                    </p>
                )}
            </section>

            <section className="mb-8">
                <span
                    className="block text-[13px] font-bold uppercase tracking-wide mb-3"
                    style={{ color: INK_MUTED }}
                >
                    Área
                </span>
                <div className="flex flex-wrap gap-2.5">
                    {REQUISITION_AREAS.map(option => {
                        const isActive = area === option;
                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setArea(option)}
                                className="h-14 px-6 rounded-full border-2 font-bold transition active:scale-95"
                                style={{
                                    backgroundColor: isActive ? accent : '#ffffff',
                                    borderColor: isActive ? accent : '#cbd5e1',
                                    color: isActive ? accentInk : INK,
                                }}
                            >
                                {option}
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="mb-10">
                <label
                    htmlFor="solicitante"
                    className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide mb-3"
                    style={{ color: INK_MUTED }}
                >
                    <UserRound size={15} strokeWidth={2.5} /> ¿Quién pide?
                </label>
                <input
                    id="solicitante"
                    type="text"
                    value={solicitante}
                    onChange={e => setSolicitante(e.target.value)}
                    placeholder="Nombre de quien solicita"
                    autoComplete="off"
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
                Continuar al catálogo
                <ArrowRight size={26} strokeWidth={3} />
            </button>
        </div>
    );
}
