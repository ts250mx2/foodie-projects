'use client';

import { useState, useEffect } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';

const WA_GREEN = '#25D366';

function getProjectId(): number | null {
    try { const p = JSON.parse(localStorage.getItem('project') || '{}'); return p.idProyecto || p.IdProyecto || null; }
    catch { return null; }
}

export default function WhatsappPhonesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [projectId, setProjectId] = useState<number | null>(null);
    const [phones, setPhones] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [newPhone, setNewPhone] = useState('+52 ');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const pid = getProjectId();
        setProjectId(pid);
        setNewPhone('+52 ');
        setError('');
        if (pid) load(pid); else setPhones([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const load = async (pid: number) => {
        setLoading(true);
        try {
            const r = await fetch(`/api/config/whatsapp-phones?projectId=${pid}`).then(x => x.json());
            setPhones(r.success ? (r.phones || []) : []);
        } catch { setPhones([]); } finally { setLoading(false); }
    };

    const add = async () => {
        if (!projectId) { setError('No se detectó un proyecto activo.'); return; }
        const tel = newPhone.trim();
        if (tel.replace(/\D/g, '').length < 8) { setError('Captura un teléfono válido.'); return; }
        setSaving(true); setError('');
        try {
            const r = await fetch('/api/config/whatsapp-phones', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, telefono: tel }),
            }).then(x => x.json());
            if (r.success) { setPhones(p => [...p, r.telefono]); setNewPhone('+52 '); }
            else setError(r.message || 'No se pudo agregar.');
        } catch { setError('Error al agregar.'); } finally { setSaving(false); }
    };

    const remove = async (tel: string) => {
        if (!projectId) return;
        setPhones(p => p.filter(x => x !== tel));
        try {
            await fetch(`/api/config/whatsapp-phones?projectId=${projectId}&telefono=${encodeURIComponent(tel)}`, { method: 'DELETE' });
        } catch { if (projectId) load(projectId); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                {/* Header verde WhatsApp */}
                <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: WA_GREEN }}>
                    <h3 className="flex items-center gap-2 text-white font-bold text-base">
                        <FaWhatsapp size={22} /> Teléfonos de WhatsApp
                    </h3>
                    <button onClick={onClose} className="p-1 text-white/90 hover:bg-white/20 rounded transition-colors"><X size={20} /></button>
                </div>

                {/* Alta */}
                <div className="px-6 pt-4 pb-2">
                    <p className="text-xs text-gray-500 mb-3">Estos números podrán consultar al agente Foodie Gurú por WhatsApp para este proyecto.</p>
                    <div className="flex gap-2">
                        <input
                            value={newPhone}
                            onChange={e => setNewPhone(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') add(); }}
                            placeholder="+52 81 1234 5678"
                            className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 outline-none focus:border-emerald-400"
                        />
                        <button onClick={add} disabled={saving}
                            className="px-4 rounded-lg text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition-all"
                            style={{ backgroundColor: WA_GREEN }}>
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Agregar
                        </button>
                    </div>
                    {error && <p className="text-xs text-red-500 mt-1.5 font-medium">{error}</p>}
                </div>

                {/* Lista */}
                <div className="px-6 py-3 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 text-gray-400 py-8"><Loader2 size={18} className="animate-spin" /> Cargando…</div>
                    ) : phones.length === 0 ? (
                        <div className="text-center text-gray-400 py-8 text-sm">Aún no hay teléfonos registrados.</div>
                    ) : (
                        <div className="space-y-1.5">
                            {phones.map(tel => (
                                <div key={tel} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/60">
                                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                                        <FaWhatsapp size={16} style={{ color: WA_GREEN }} /> {tel}
                                    </span>
                                    <button onClick={() => remove(tel)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Quitar">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100">Cerrar</button>
                </div>
            </div>
        </div>
    );
}
