'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'react-qr-code';
import { Copy, Check, RefreshCw, TabletSmartphone } from 'lucide-react';
import BaseModal from '@/components/BaseModal';
import Button from '@/components/Button';

interface RequisitionLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number | null;
}

/**
 * Liga y QR de la tablet de cocina. Quien escanee este código puede levantar
 * requisiciones sin usuario ni contraseña, así que el modal advierte de ello y
 * ofrece regenerar la liga si la tablet se pierde.
 */
export default function RequisitionLinkModal({ isOpen, onClose, projectId }: RequisitionLinkModalProps) {
    const params = useParams();
    const locale = (params?.locale as string) || 'es';

    const [uuid, setUuid] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadLink = useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/requisitions/link?projectId=${projectId}`);
            const data = await res.json();
            if (data.success) setUuid(data.uuid);
            else setError(data.message || 'No se pudo obtener la liga');
        } catch {
            setError('No se pudo obtener la liga');
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (isOpen) loadLink();
    }, [isOpen, loadLink]);

    const url = uuid && typeof window !== 'undefined'
        ? `${window.location.origin}/${locale}/requisicion/${uuid}`
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
            const res = await fetch('/api/requisitions/link', {
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
            title="Requisiciones desde tablet"
            subtitle="Escanea el QR en la tablet de cocina"
            size="md"
        >
            <div className="flex flex-col items-center gap-5 py-2">
                <div className="bg-white p-5 rounded-2xl border-2 border-gray-100">
                    {url ? (
                        <QRCode value={url} size={200} bgColor="transparent" fgColor="#14532d" />
                    ) : (
                        <div className="h-[200px] w-[200px] flex items-center justify-center text-sm text-gray-400">
                            {isLoading ? 'Generando…' : error || 'Sin liga'}
                        </div>
                    )}
                </div>

                {url && (
                    <div className="w-full">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Liga directa</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 break-all font-mono">
                                {url}
                            </code>
                            <Button
                                leftIcon={isCopied ? Check : Copy}
                                onClick={handleCopy}
                                size="sm"
                                variant="secondary"
                            >
                                {isCopied ? 'Copiada' : 'Copiar'}
                            </Button>
                        </div>
                    </div>
                )}

                <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                    <p className="text-xs text-amber-900 leading-relaxed">
                        <TabletSmartphone size={13} className="inline-block mr-1 -mt-0.5" />
                        Esta liga <strong>no pide usuario ni contraseña</strong>: quien la tenga puede levantar
                        requisiciones. Las requisiciones llegan como orden de compra interna <strong>sin surtir</strong>,
                        así que nada afecta el inventario hasta que tú la apliques desde esta pantalla.
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
