'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Cada cuánto se repite el aviso mientras haya requisiciones sin atender. */
const REPEAT_MS = 4000;

/** Volumen del pico de cada tono (0–1). */
const PEAK_GAIN = 0.32;

type WindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * Alarma sonora de requisiciones nuevas.
 *
 * Suena en cuanto llega una requisición y NO para hasta que se atienden todas:
 * mientras `active` siga en true repite un doble tono cada 4 segundos. Se
 * sintetiza con Web Audio en vez de un archivo de audio para no depender de un
 * asset ni de que el navegador lo tenga cacheado.
 *
 * Los navegadores bloquean el audio hasta que hay un gesto del usuario, así que
 * el AudioContext arranca suspendido. Se reanuda solo al primer clic o tecla en
 * el portal; si aún no ha habido ninguno, `needsUnlock` queda en true para que
 * la UI ofrezca un botón — de lo contrario la alarma fallaría en silencio.
 */
export function useRequisitionAlarm(active: boolean) {
    const contextRef = useRef<AudioContext | null>(null);
    const [needsUnlock, setNeedsUnlock] = useState(false);

    const getContext = useCallback((): AudioContext | null => {
        if (typeof window === 'undefined') return null;
        if (!contextRef.current) {
            const Ctor = window.AudioContext || (window as WindowWithAudio).webkitAudioContext;
            if (!Ctor) return null;
            try {
                contextRef.current = new Ctor();
            } catch {
                return null;
            }
        }
        return contextRef.current;
    }, []);

    /** Doble tono ascendente. Devuelve false si el navegador aún lo bloquea. */
    const ring = useCallback((): boolean => {
        const audio = getContext();
        if (!audio) return false;

        if (audio.state === 'suspended') {
            audio.resume().catch(() => { /* sigue bloqueado hasta que haya gesto */ });
            if (audio.state === 'suspended') return false;
        }

        const start = audio.currentTime;
        [880, 1320].forEach((frequency, index) => {
            const offset = index * 0.18;
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();

            oscillator.type = 'triangle';
            oscillator.frequency.value = frequency;

            // Rampas exponenciales: un corte seco produce un chasquido audible.
            gain.gain.setValueAtTime(0.0001, start + offset);
            gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, start + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.17);

            oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.start(start + offset);
            oscillator.stop(start + offset + 0.2);
        });

        return true;
    }, [getContext]);

    /** Lo llama el botón "activar sonido" del portal. */
    const unlock = useCallback(async () => {
        const audio = getContext();
        if (!audio) return;
        try {
            await audio.resume();
            setNeedsUnlock(false);
            ring();
        } catch { /* el navegador lo sigue bloqueando */ }
    }, [getContext, ring]);

    // Cualquier interacción en el portal desbloquea el audio para siempre.
    useEffect(() => {
        const resumeOnGesture = () => {
            const audio = contextRef.current;
            if (!audio || audio.state !== 'suspended') return;
            audio.resume().then(() => setNeedsUnlock(false)).catch(() => { /* sigue bloqueado */ });
        };

        window.addEventListener('pointerdown', resumeOnGesture);
        window.addEventListener('keydown', resumeOnGesture);
        return () => {
            window.removeEventListener('pointerdown', resumeOnGesture);
            window.removeEventListener('keydown', resumeOnGesture);
        };
    }, []);

    useEffect(() => {
        if (!active) return;

        // El primer toque va en un timer para no tocar estado de forma síncrona
        // dentro del efecto; 0 ms lo hace igualmente inmediato.
        const kickoff = setTimeout(() => {
            if (!ring()) setNeedsUnlock(true);
        }, 0);

        const interval = setInterval(() => {
            if (!ring()) setNeedsUnlock(true);
        }, REPEAT_MS);

        return () => {
            clearTimeout(kickoff);
            clearInterval(interval);
        };
    }, [active, ring]);

    useEffect(() => {
        return () => {
            contextRef.current?.close().catch(() => { /* ya estaba cerrado */ });
            contextRef.current = null;
        };
    }, []);

    return { needsUnlock, unlock };
}
