'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'react-qr-code';
import { Copy, Check, RefreshCw, TabletSmartphone, ExternalLink } from 'lucide-react';
import BaseModal from '@/components/BaseModal';
import Button from '@/components/Button';

interface SurveyBranch {
    IdSucursal: number;
    Sucursal: string;
}

interface SurveyLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number | null;
    /** Color del módulo, para que el modal case con el resto de la pantalla. */
    accentColor?: string;
}

/**
 * Liga y QR de la encuesta para tablet. Quien escanee este código puede
 * contestar la encuesta sin usuario ni contraseña. Se puede etiquetar la
 * sucursal de la tablet (agrega ?s=IdSucursal a la liga) para que el reporte
 * distinga de dónde vino cada respuesta.
 */
export default function SurveyLinkModal({ isOpen, onClose, projectId, accentColor }: SurveyLinkModalProps) {
    const params = useParams();
    const locale = (params?.locale as string) || 'es';

    const [uuid, setUuid] = useState<string | null>(null);
    const [branches, setBranches] = useState<SurveyBranch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadLink = useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/surveys/link?projectId=${projectId}`);
            const data = await res.json();
            if (data.success) setUuid(data.uuid);
            else setError(data.message || 'No se pudo obtener la liga');
        } catch {
            setError('No se pudo obtener la liga');
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    const loadBranches = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/branches?projectId=${projectId}`);
            const data = await res.json();
            if (data.success) setBranches(data.data || []);
        } catch { /* sin sucursales la liga general sigue sirviendo */ }
    }, [projectId]);

    useEffect(() => {
        if (isOpen) {
            loadLink();
            loadBranches();
        }
    }, [isOpen, loadLink, loadBranches]);

    const url = uuid && typeof window !== 'undefined'
        ? `${window.location.origin}/${locale}/encuesta/${uuid}${selectedBranch ? `?s=${selectedBranch}` : ''}`
        : '';

    const handleCopy = async () => {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch { /* el usuario puede copiarla a mano del texto visible */ }
    };

    const handleRotate = async () => {
        if (!projectId) return;
        const confirmed = window.confirm(
            'Al regenerar la liga, las tablets que ya la tengan dejarán de funcionar y habrá que volver a escanear el QR. ¿Continuar?'
        );
        if (!confirmed) return;

        setIsLoading(true);
        try {
            const res = await fetch('/api/surveys/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId }),
            });
            const data = await res.json();
            if (data.success) setUuid(data.uuid);
            else setError(data.message || 'No se pudo regenerar la liga');
        } catch {
            setError('No se pudo regenerar la liga');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Encuesta desde tablet"
            subtitle="Escanea el QR en la tablet de piso o compártelo con tus comensales"
            size="md"
            accentColor={accentColor}
        >
            <div className="flex flex-col items-center gap-5 py-2">
                <div className="bg-white p-5 rounded-2xl border-2 border-gray-100">
                    {url ? (
                        <QRCode value={url} size={200} bgColor="transparent" fgColor={accentColor ?? '#6d28d9'} />
                    ) : (
                        <div className="h-[200px] w-[200px] flex items-center justify-center text-sm text-gray-400">
                            {isLoading ? 'Generando…' : error || 'Sin liga'}
                        </div>
                    )}
                </div>

                {branches.length > 0 && (
                    <div className="w-full">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                            Sucursal de la tablet (opcional)
                        </p>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(Number(e.target.value))}
                            className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                        >
                            <option value={0}>Sin sucursal (liga general)</option>
                            {branches.map(b => (
                                <option key={b.IdSucursal} value={b.IdSucursal}>{b.Sucursal}</option>
                            ))}
                        </select>
                        <p className="text-[11px] text-gray-400 mt-1">
                            El reporte agrupa las respuestas por la sucursal de la liga escaneada.
                        </p>
                    </div>
                )}

                {url && (
                    <div className="w-full">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Liga directa</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 break-all font-mono">
                                {url}
                            </code>
                            <div className="flex flex-col gap-1.5">
                                <Button
                                    leftIcon={isCopied ? Check : Copy}
                                    onClick={handleCopy}
                                    size="sm"
                                    variant="secondary"
                                >
                                    {isCopied ? 'Copiada' : 'Copiar'}
                                </Button>
                                <Button
                                    leftIcon={ExternalLink}
                                    onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                                    size="sm"
                                    variant="secondary"
                                >
                                    Abrir
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                    <p className="text-xs text-amber-900 leading-relaxed">
                        <TabletSmartphone size={13} className="inline-block mr-1 -mt-0.5" />
                        Esta liga <strong>no pide usuario ni contraseña</strong>: quien la tenga puede contestar
                        la encuesta. Solo captura calificaciones, comentarios y el correo que el comensal
                        decida dejar; no expone ningún dato del negocio.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleRotate}
                    disabled={isLoading || !projectId}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-rose-600 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={13} />
                    Regenerar liga (invalida las tablets actuales)
                </button>
            </div>
        </BaseModal>
    );
}
