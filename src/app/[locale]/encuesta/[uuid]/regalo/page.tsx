'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Gift, Loader2 } from 'lucide-react';
import { INK, INK_MUTED, CANVAS, BORDER } from '@/components/requisitions/theme';

/**
 * Página del regalo: el comensal llega aquí escaneando el QR de la pantalla
 * de gracias con SU celular. Muestra el flyer de promoción que el restaurante
 * subió en Configurar Encuesta. Sin login: el UUID de la liga es la credencial.
 */

type Stage = 'loading' | 'unavailable' | 'ready';

export default function SurveyGiftPage() {
    const params = useParams();
    const uuid = (params?.uuid as string) || '';

    const [stage, setStage] = useState<Stage>('loading');
    const [flyerSrc, setFlyerSrc] = useState<string | null>(null);

    useEffect(() => {
        if (!uuid) {
            setStage('unavailable');
            return;
        }
        const controller = new AbortController();
        let objectUrl: string | null = null;
        (async () => {
            try {
                const res = await fetch(`/api/surveys/flyer?uuid=${encodeURIComponent(uuid)}`, {
                    signal: controller.signal,
                });
                if (!res.ok) {
                    setStage('unavailable');
                    return;
                }
                const blob = await res.blob();
                objectUrl = URL.createObjectURL(blob);
                setFlyerSrc(objectUrl);
                setStage('ready');
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error('Error loading flyer:', error);
                    setStage('unavailable');
                }
            }
        })();
        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [uuid]);

    if (stage === 'loading') {
        return (
            <main className="min-h-dvh flex items-center justify-center" style={{ backgroundColor: CANVAS }}>
                <Loader2 size={40} className="animate-spin" style={{ color: INK_MUTED }} />
            </main>
        );
    }

    if (stage === 'unavailable' || !flyerSrc) {
        return (
            <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-8 text-center" style={{ backgroundColor: CANVAS }}>
                <div className="h-20 w-20 rounded-full bg-white border-2 flex items-center justify-center" style={{ borderColor: BORDER }}>
                    <Gift size={36} style={{ color: INK_MUTED }} />
                </div>
                <h1 className="text-2xl font-black" style={{ color: INK }}>Promoción no disponible</h1>
                <p className="text-base font-medium max-w-sm" style={{ color: INK_MUTED }}>
                    Esta promoción ya no está activa. Pregunta en el restaurante por las promociones vigentes.
                </p>
            </main>
        );
    }

    return (
        <main className="min-h-dvh flex flex-col items-center px-4 py-6 gap-4" style={{ backgroundColor: CANVAS }}>
            <div className="w-full max-w-md bg-white rounded-3xl border-2 shadow-sm overflow-hidden" style={{ borderColor: BORDER }}>
                <img
                    src={flyerSrc}
                    alt="Flyer de promoción"
                    className="w-full h-auto block"
                />
            </div>
            <p className="text-sm font-bold text-center max-w-md" style={{ color: INK }}>
                <Gift size={16} className="inline mr-1.5 -mt-0.5" />
                Muestra esta pantalla en el restaurante para reclamar tu regalo.
            </p>
        </main>
    );
}
