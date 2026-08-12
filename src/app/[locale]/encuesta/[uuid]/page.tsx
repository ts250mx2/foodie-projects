'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'react-qr-code';
import {
    Star,
    UtensilsCrossed,
    MessageCircle,
    Gift,
    Mail,
    Phone,
    Send,
    CheckCircle2,
    LockKeyhole,
    Loader2,
    UserRound,
} from 'lucide-react';
import { INK, INK_SOFT, INK_MUTED, CANVAS, BORDER } from '@/components/requisitions/theme';

/**
 * Encuesta pública de satisfacción (tablet en piso o celular del comensal).
 *
 * SIN LOGIN: la única credencial es el UUID de la URL. Todo el contenido
 * (textos, preguntas, umbral del comentario y bloque de regalo) viene de la
 * configuración del proyecto vía /api/surveys/session. La liga puede traer
 * ?s=IdSucursal para etiquetar de qué sucursal es la tablet.
 */

interface SurveyTheme {
    titulo: string;
    logo64: string | null;
    colorFondo1: string;
}

interface SurveyConfig {
    titulo: string;
    subtitulo: string | null;
    subtitulo2: string | null;
    umbralComentario: number;
    tituloComentario: string;
    textoComentario: string | null;
    regaloActivo: number;
    tituloRegalo: string;
    textoRegalo: string | null;
    textoPromos: string;
    textoBotonEnviar: string;
    tituloGracias: string;
    textoGracias: string | null;
    atencionActiva: number;
    atencionTitulo: string;
    atencionTexto: string | null;
    /** lista = solo predefinidos · texto = abierto · ambos = lista con "Otro". */
    atencionModo: 'lista' | 'texto' | 'ambos';
    atencionObligatoria: number;
    /** 1 = hay flyer de promoción: la pantalla de gracias muestra el QR. */
    tieneFlyer: number;
}

interface SurveyAttendant {
    idAtendio: number;
    nombre: string;
}

/** Marca de "Otro" en el selector: no es un id real de la lista. */
const OTHER_ATTENDANT = -1;

interface SurveyQuestion {
    idPregunta: number;
    pregunta: string;
    tipo: 'estrellas' | 'opciones';
    etiquetas: string[];
}

interface SurveyBranch {
    IdSucursal: number;
    Sucursal: string;
}

type Stage = 'loading' | 'invalid' | 'form' | 'sent';

/** Ámbar clásico de calificación: se lee igual con cualquier color de marca. */
const STAR_FILL = '#f59e0b';
/** Segundos que la pantalla de gracias espera antes de reiniciar para el siguiente comensal. */
const KIOSK_RESET_SECONDS = 12;
/** Con QR del regalo en pantalla, el comensal necesita tiempo de sacar su celular y escanear. */
const KIOSK_RESET_FLYER_SECONDS = 30;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mismo criterio que el servidor: formato flexible pero 8-15 dígitos.
const PHONE_CHARS_PATTERN = /^\+?[\d\s\-().]+$/;
const isValidPhone = (phone: string) => {
    if (!PHONE_CHARS_PATTERN.test(phone)) return false;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
};

export default function PublicSurveyPage() {
    const params = useParams();
    const uuid = (params?.uuid as string) || '';
    const locale = (params?.locale as string) || 'es';

    const [stage, setStage] = useState<Stage>('loading');
    const [theme, setTheme] = useState<SurveyTheme | null>(null);
    const [config, setConfig] = useState<SurveyConfig | null>(null);
    const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
    const [branchId, setBranchId] = useState<number | null>(null);
    const [branchName, setBranchName] = useState<string | null>(null);

    const [attendants, setAttendants] = useState<SurveyAttendant[]>([]);

    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [comment, setComment] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [wantsPromos, setWantsPromos] = useState(false);
    const [missingIds, setMissingIds] = useState<number[]>([]);
    // Un solo error para el bloque de contacto (teléfono y/o correo).
    const [contactError, setContactError] = useState('');
    // Quién atendió: id de la lista, OTHER_ATTENDANT si eligió "Otro", o null.
    const [attendantId, setAttendantId] = useState<number | null>(null);
    const [attendantName, setAttendantName] = useState('');
    const [attendantError, setAttendantError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [isSending, setIsSending] = useState(false);

    const questionRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const attendantRef = useRef<HTMLElement | null>(null);

    /**
     * Carga (o recarga) la configuración y preguntas vigentes. La tablet vive
     * abierta días: sin recargas, editar una pregunta en el portal dejaría a
     * la tablet mandando respuestas que el servidor ya no acepta.
     */
    const loadSession = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
        const res = await fetch(`/api/surveys/session?uuid=${encodeURIComponent(uuid)}`, { signal });
        const data = await res.json();
        if (!data.success) return false;

        setTheme(data.project);
        setConfig(data.config);
        const nextAttendants: SurveyAttendant[] = data.attendants || [];
        setAttendants(nextAttendants);
        // Si la persona elegida desapareció de la lista mientras la tablet
        // estaba abierta, se limpia en vez de mandar un id que ya no existe.
        setAttendantId(prev =>
            prev === null || prev === OTHER_ATTENDANT || nextAttendants.some(a => a.idAtendio === prev)
                ? prev
                : null
        );
        const nextQuestions: SurveyQuestion[] = data.questions || [];
        setQuestions(nextQuestions);
        // Poda respuestas de preguntas que ya no existen o se desactivaron.
        setAnswers(prev => {
            const keep: Record<number, number> = {};
            for (const q of nextQuestions) {
                if (prev[q.idPregunta]) keep[q.idPregunta] = prev[q.idPregunta];
            }
            return keep;
        });

        // ?s=IdSucursal en la liga etiqueta la sucursal de la tablet.
        const sParam = Number(new URLSearchParams(window.location.search).get('s'));
        if (Number.isInteger(sParam) && sParam > 0) {
            const branch = (data.branches || []).find((b: SurveyBranch) => b.IdSucursal === sParam);
            if (branch) {
                setBranchId(branch.IdSucursal);
                setBranchName(branch.Sucursal);
            }
        }
        return true;
    }, [uuid]);

    useEffect(() => {
        if (!uuid) {
            setStage('invalid');
            return;
        }
        const controller = new AbortController();
        (async () => {
            try {
                const ok = await loadSession(controller.signal);
                setStage(ok ? 'form' : 'invalid');
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error('Error loading survey:', error);
                    setStage('invalid');
                }
            }
        })();
        return () => controller.abort();
    }, [uuid, loadSession]);

    const resetForNextGuest = useCallback(() => {
        setAnswers({});
        setComment('');
        setEmail('');
        setPhone('');
        setWantsPromos(false);
        setMissingIds([]);
        setContactError('');
        setSubmitError('');
        setAttendantId(null);
        setAttendantName('');
        setAttendantError('');
        setStage('form');
        window.scrollTo({ top: 0 });
        // Refresca preguntas/textos entre comensales; si falla, el formulario
        // anterior sigue sirviendo y el submit se encarga de resincronizar.
        loadSession().catch(() => { /* sin conexión momentánea: no pasa nada */ });
    }, [loadSession]);

    // Modo kiosco: tras agradecer, la tablet queda lista para el siguiente.
    useEffect(() => {
        if (stage !== 'sent') return;
        const seconds = config?.tieneFlyer === 1 ? KIOSK_RESET_FLYER_SECONDS : KIOSK_RESET_SECONDS;
        const id = setTimeout(resetForNextGuest, seconds * 1000);
        return () => clearTimeout(id);
    }, [stage, resetForNextGuest, config?.tieneFlyer]);

    const setAnswer = (idPregunta: number, valor: number) => {
        setAnswers(prev => ({ ...prev, [idPregunta]: valor }));
        setMissingIds(prev => prev.filter(id => id !== idPregunta));
    };

    // El comentario abierto solo aparece si alguna calificación cae en el
    // umbral configurado (ej. 1, 2 o 3 estrellas). Umbral 0 = nunca. Las
    // preguntas de opciones con menos de 5 opciones se normalizan a escala
    // de 5 para que el umbral pese igual en todas.
    const umbral = config?.umbralComentario ?? 0;
    const showComment = umbral > 0 && questions.some(q => {
        const valor = answers[q.idPregunta];
        if (!valor) return false;
        const max = q.tipo === 'opciones' ? Math.max(q.etiquetas.length, 1) : 5;
        return (valor / max) * 5 <= umbral;
    });

    // Nombre que se manda cuando el comensal escribe en lugar de elegir.
    const showAttendant = config?.atencionActiva === 1;
    const hasAttendantList = attendants.length > 0;
    const showAttendantList = showAttendant && config?.atencionModo !== 'texto' && hasAttendantList;
    // En 'ambos' el texto abierto sale al tocar "Otro"; si la lista quedó
    // vacía, el bloque se comporta como texto abierto en vez de no ofrecer nada.
    const showAttendantText = showAttendant && (
        config?.atencionModo === 'texto' ||
        (config?.atencionModo === 'ambos' && (attendantId === OTHER_ATTENDANT || !hasAttendantList))
    );
    const selectedAttendantId = attendantId !== null && attendantId > 0 ? attendantId : null;
    const typedAttendant = showAttendantText ? attendantName.trim() : '';

    const handleSubmit = async () => {
        if (!config || isSending) return;
        setSubmitError('');

        const missing = questions.filter(q => !answers[q.idPregunta]).map(q => q.idPregunta);
        if (missing.length > 0) {
            setMissingIds(missing);
            const first = questionRefs.current[missing[0]];
            first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        if (showAttendant && config.atencionObligatoria === 1 && !selectedAttendantId && !typedAttendant) {
            setAttendantError(config.atencionModo === 'texto'
                ? 'Escribe quién te atendió.'
                : 'Elige quién te atendió.');
            attendantRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        setAttendantError('');

        const cleanEmail = email.trim();
        const cleanPhone = phone.trim();
        if (cleanEmail && !EMAIL_PATTERN.test(cleanEmail)) {
            setContactError('Revisa el correo: no parece válido.');
            return;
        }
        if (cleanPhone && !isValidPhone(cleanPhone)) {
            setContactError('Revisa el teléfono: no parece válido.');
            return;
        }
        // Con regalo activo el contacto es obligatorio (por ahí llegan regalo
        // y promociones); con el regalo apagado la encuesta sigue anónima.
        if (config.regaloActivo === 1 && !cleanEmail && !cleanPhone) {
            setContactError('Escribe tu teléfono o tu correo para enviar la encuesta.');
            return;
        }
        setContactError('');

        setIsSending(true);
        try {
            const res = await fetch('/api/surveys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uuid,
                    respuestas: questions.map(q => ({ idPregunta: q.idPregunta, valor: answers[q.idPregunta] })),
                    comentario: showComment ? comment : null,
                    correo: cleanEmail || null,
                    telefono: cleanPhone || null,
                    aceptaPromos: wantsPromos,
                    idSucursal: branchId,
                    idAtendio: selectedAttendantId,
                    atendio: typedAttendant || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setStage('sent');
                window.scrollTo({ top: 0 });
            } else if (data.message === 'Faltan preguntas por contestar' || data.message === 'Respuestas inválidas') {
                // Las preguntas cambiaron en el portal mientras la tablet
                // estaba abierta: se recargan y el comensal solo completa
                // lo que falte (sus respuestas vigentes se conservan).
                try { await loadSession(); } catch { /* reintentará con el mismo aviso */ }
                setSubmitError('La encuesta se actualizó. Revisa tus respuestas e intenta de nuevo.');
            } else {
                setSubmitError(data.message || 'No se pudo enviar la encuesta. Intenta de nuevo.');
            }
        } catch (error) {
            console.error('Error submitting survey:', error);
            setSubmitError('No se pudo enviar la encuesta. Revisa la conexión e intenta de nuevo.');
        } finally {
            setIsSending(false);
        }
    };

    if (stage === 'loading') {
        return (
            <main className="min-h-dvh flex items-center justify-center" style={{ backgroundColor: CANVAS }}>
                <Loader2 size={40} className="animate-spin" style={{ color: INK_MUTED }} />
            </main>
        );
    }

    if (stage === 'invalid') {
        return (
            <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-8 text-center" style={{ backgroundColor: CANVAS }}>
                <div className="h-20 w-20 rounded-full bg-white border-2 flex items-center justify-center" style={{ borderColor: BORDER }}>
                    <LockKeyhole size={36} style={{ color: INK_MUTED }} />
                </div>
                <h1 className="text-2xl font-black" style={{ color: INK }}>Liga no válida</h1>
                <p className="text-base font-medium max-w-sm" style={{ color: INK_MUTED }}>
                    Esta liga de encuesta no existe o fue desactivada. Pide al restaurante una liga nueva.
                </p>
            </main>
        );
    }

    if (stage === 'sent' && config) {
        // QR al flyer de promoción: el comensal lo escanea con SU celular; la
        // liga es la misma de la encuesta más /regalo, así que no expone nada
        // que la tablet no tenga ya.
        const giftUrl = config.tieneFlyer === 1 && typeof window !== 'undefined'
            ? `${window.location.origin}/${locale}/encuesta/${uuid}/regalo`
            : '';
        return (
            <main className="min-h-dvh flex items-center justify-center px-5" style={{ backgroundColor: CANVAS }}>
                <div className="w-full max-w-xl bg-white rounded-3xl border-2 px-8 py-12 text-center flex flex-col items-center gap-5 shadow-sm" style={{ borderColor: BORDER }}>
                    <div className="h-24 w-24 rounded-full flex items-center justify-center" style={{ backgroundColor: INK }}>
                        <CheckCircle2 size={52} color="#ffffff" strokeWidth={2} />
                    </div>
                    <h1 className="text-3xl font-black uppercase tracking-tight leading-tight" style={{ color: INK }}>
                        {config.tituloGracias}
                    </h1>
                    {config.textoGracias && (
                        <p className="text-lg font-medium whitespace-pre-line" style={{ color: INK_MUTED }}>
                            {config.textoGracias}
                        </p>
                    )}
                    {giftUrl && (
                        <div className="flex flex-col items-center gap-2.5">
                            <div className="bg-white p-4 rounded-2xl border-2" style={{ borderColor: INK }}>
                                <QRCode value={giftUrl} size={168} bgColor="transparent" fgColor={INK} />
                            </div>
                            <p className="text-base font-bold flex items-center gap-2" style={{ color: INK }}>
                                <Gift size={18} strokeWidth={2.2} />
                                Escanea con tu celular y llévate tu regalo
                            </p>
                            {/* Quien contesta desde SU celular no puede escanear la
                                pantalla que está viendo: el botón abre el mismo flyer. */}
                            <a
                                href={giftUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-14 px-8 rounded-2xl font-black text-base uppercase tracking-wide flex items-center justify-center gap-2.5 active:scale-[0.98] transition shadow-sm"
                                style={{ backgroundColor: INK, color: '#ffffff' }}
                            >
                                <Gift size={20} strokeWidth={2.2} />
                                Abrir mi regalo
                            </a>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={resetForNextGuest}
                        className="mt-2 h-14 px-8 rounded-2xl font-bold text-base border-2 bg-white active:scale-[0.98] transition"
                        style={{ borderColor: BORDER, color: INK }}
                    >
                        Contestar otra encuesta
                    </button>
                </div>
            </main>
        );
    }

    if (!config) return null;

    // Liga válida pero sin preguntas activas: mejor un aviso claro que un
    // formulario vacío cuyo envío siempre fallaría.
    if (questions.length === 0) {
        return (
            <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-8 text-center" style={{ backgroundColor: CANVAS }}>
                <div className="h-20 w-20 rounded-full bg-white border-2 flex items-center justify-center" style={{ borderColor: BORDER }}>
                    <UtensilsCrossed size={34} style={{ color: INK_MUTED }} />
                </div>
                <h1 className="text-2xl font-black" style={{ color: INK }}>Encuesta no disponible</h1>
                <p className="text-base font-medium max-w-sm" style={{ color: INK_MUTED }}>
                    Por el momento no hay preguntas activas. Vuelve a intentarlo más tarde.
                </p>
            </main>
        );
    }

    return (
        <main className="min-h-dvh pb-10" style={{ backgroundColor: CANVAS }}>
            {/* max-w-3xl: en tablet, 2xl dejaba las respuestas en una franja
                demasiado estrecha para etiquetas como "Definitivamente sí". */}
            <div className="mx-auto w-full max-w-3xl px-4 pt-10 flex flex-col gap-5">
                {/* Encabezado */}
                <header className="flex flex-col items-center text-center gap-3">
                    {theme?.logo64 ? (
                        <img
                            src={theme.logo64}
                            alt=""
                            className="h-20 w-20 rounded-full object-cover border-2 bg-white"
                            style={{ borderColor: INK }}
                        />
                    ) : (
                        <div className="h-20 w-20 rounded-full border-[3px] flex items-center justify-center bg-white" style={{ borderColor: INK }}>
                            <UtensilsCrossed size={34} style={{ color: INK }} strokeWidth={2} />
                        </div>
                    )}
                    <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight leading-none" style={{ color: INK }}>
                        {config.titulo}
                    </h1>
                    <div>
                        {config.subtitulo && (
                            <p className="text-lg font-medium" style={{ color: INK_MUTED }}>{config.subtitulo}</p>
                        )}
                        {config.subtitulo2 && (
                            <p className="text-lg font-bold" style={{ color: INK }}>{config.subtitulo2}</p>
                        )}
                        {(theme?.titulo || branchName) && (
                            <p className="mt-1 text-[13px] font-semibold uppercase tracking-wider" style={{ color: INK_MUTED }}>
                                {[theme?.titulo, branchName].filter(Boolean).join(' · ')}
                            </p>
                        )}
                    </div>
                </header>

                {/* Preguntas */}
                <section className="bg-white rounded-3xl border-2 px-5 sm:px-7 shadow-sm" style={{ borderColor: BORDER }}>
                    {questions.map((question, index) => {
                        const isMissing = missingIds.includes(question.idPregunta);
                        const selected = answers[question.idPregunta];
                        return (
                            <div
                                key={question.idPregunta}
                                ref={el => { questionRefs.current[question.idPregunta] = el; }}
                                className={`py-6 flex flex-col md:flex-row md:items-center gap-4 ${index > 0 ? 'border-t' : ''} ${isMissing ? 'rounded-2xl ring-2 ring-red-400 px-3 -mx-3' : ''}`}
                                style={{ borderColor: '#e2e8f0' }}
                            >
                                <div className="flex items-start gap-3 md:w-[45%] shrink-0">
                                    <span
                                        // Color inline, no `text-white`: las reglas globales sin capa
                                        // (span { color: inherit }) le ganan a las utilidades de
                                        // Tailwind y el número heredaba tinta oscura sobre fondo oscuro.
                                        className="h-9 w-9 rounded-full flex items-center justify-center font-black text-base shrink-0"
                                        style={{ backgroundColor: INK, color: '#ffffff' }}
                                    >
                                        {index + 1}
                                    </span>
                                    <p className="text-[17px] font-semibold leading-snug pt-1" style={{ color: INK }}>
                                        {question.pregunta}
                                    </p>
                                </div>

                                {question.tipo === 'estrellas' ? (
                                    /* min-w-0 en cada botón: sin él la celda del grid crece con
                                       la etiqueta más larga y las etiquetas se encinan entre sí. */
                                    <div className="flex-1 grid grid-cols-5 gap-1.5">
                                        {Array.from({ length: 5 }, (_, i) => {
                                            const valor = i + 1;
                                            const isActive = selected != null && valor <= selected;
                                            return (
                                                <button
                                                    key={valor}
                                                    type="button"
                                                    onClick={() => setAnswer(question.idPregunta, valor)}
                                                    className="min-w-0 flex flex-col items-center gap-1 px-0.5 py-1 rounded-xl active:scale-95 transition"
                                                    aria-label={`${valor} de 5`}
                                                    aria-pressed={selected === valor}
                                                >
                                                    <Star
                                                        size={38}
                                                        strokeWidth={1.8}
                                                        fill={isActive ? STAR_FILL : 'none'}
                                                        color={isActive ? STAR_FILL : INK}
                                                        className="shrink-0"
                                                    />
                                                    <span className="text-sm font-bold" style={{ color: INK }}>{valor}</span>
                                                    {question.etiquetas[i] && (
                                                        <span
                                                            className="w-full text-[12px] font-semibold leading-tight text-center [overflow-wrap:anywhere] hyphens-auto"
                                                            style={{ color: INK_SOFT }}
                                                        >
                                                            {question.etiquetas[i]}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    /* Las opciones NO se reparten en N columnas fijas: con 5
                                       etiquetas largas cada columna quedaba de ~60px y el texto
                                       se salía encima de la vecina. Ahora cada una tiene ancho
                                       mínimo usable y el renglón se acomoda solo. */
                                    <div className="flex-1 flex flex-wrap gap-2">
                                        {question.etiquetas.map((label, i) => {
                                            // La primera opción vale más: con N opciones, valor N.
                                            const valor = question.etiquetas.length - i;
                                            const isActive = selected === valor;
                                            return (
                                                <button
                                                    key={`${valor}-${label}`}
                                                    type="button"
                                                    onClick={() => setAnswer(question.idPregunta, valor)}
                                                    className="flex-1 min-w-[92px] flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-2xl border-2 transition active:scale-95"
                                                    style={{
                                                        borderColor: isActive ? INK : BORDER,
                                                        backgroundColor: isActive ? INK : '#ffffff',
                                                    }}
                                                    aria-pressed={isActive}
                                                >
                                                    <span
                                                        className="h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0"
                                                        style={{ borderColor: isActive ? '#ffffff' : INK }}
                                                    >
                                                        {isActive && <span className="h-3.5 w-3.5 rounded-full bg-white" />}
                                                    </span>
                                                    <span
                                                        className="w-full text-[12px] font-semibold leading-tight text-center [overflow-wrap:anywhere] hyphens-auto"
                                                        style={{ color: isActive ? '#ffffff' : INK }}
                                                    >
                                                        {label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </section>
                {missingIds.length > 0 && (
                    <p className="text-sm font-bold text-center -mt-2" style={{ color: '#dc2626' }}>
                        {missingIds.length === 1
                            ? 'Te falta una pregunta por contestar.'
                            : `Te faltan ${missingIds.length} preguntas por contestar.`}
                    </p>
                )}

                {/* ¿Quién te atendió? — lista predefinida, texto abierto o ambos */}
                {showAttendant && (
                    <section
                        ref={attendantRef}
                        className={`bg-white rounded-3xl border-2 p-5 sm:p-7 shadow-sm flex flex-col sm:flex-row gap-4 ${attendantError ? 'ring-2 ring-red-400' : ''}`}
                        style={{ borderColor: BORDER }}
                    >
                        <div className="h-14 w-14 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: INK }}>
                            <UserRound size={26} color="#ffffff" />
                        </div>
                        <div className="flex-1 flex flex-col gap-3">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: INK }}>
                                    {config.atencionTitulo}
                                    {config.atencionObligatoria === 1 && <span style={{ color: '#dc2626' }}> *</span>}
                                </h2>
                                {config.atencionTexto && (
                                    <p className="text-[15px] font-medium mt-1" style={{ color: INK_MUTED }}>
                                        {config.atencionTexto}
                                    </p>
                                )}
                            </div>

                            {showAttendantList && (
                                <div className="flex flex-wrap gap-2">
                                    {attendants.map(person => {
                                        const isActive = attendantId === person.idAtendio;
                                        return (
                                            <button
                                                key={person.idAtendio}
                                                type="button"
                                                onClick={() => {
                                                    // Volver a tocar deselecciona: nadie queda obligado
                                                    // a dejar señalada a una persona por error.
                                                    setAttendantId(isActive ? null : person.idAtendio);
                                                    setAttendantName('');
                                                    setAttendantError('');
                                                }}
                                                aria-pressed={isActive}
                                                className="min-h-14 max-w-full px-5 py-3 rounded-2xl border-2 font-bold text-base text-center [overflow-wrap:anywhere] transition active:scale-95"
                                                style={{
                                                    backgroundColor: isActive ? INK : '#ffffff',
                                                    borderColor: isActive ? INK : BORDER,
                                                    color: isActive ? '#ffffff' : INK,
                                                }}
                                            >
                                                {person.nombre}
                                            </button>
                                        );
                                    })}

                                    {config.atencionModo === 'ambos' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const isOther = attendantId === OTHER_ATTENDANT;
                                                setAttendantId(isOther ? null : OTHER_ATTENDANT);
                                                if (isOther) setAttendantName('');
                                                setAttendantError('');
                                            }}
                                            aria-pressed={attendantId === OTHER_ATTENDANT}
                                            className="min-h-14 px-5 py-3 rounded-2xl border-2 border-dashed font-bold text-base transition active:scale-95"
                                            style={{
                                                backgroundColor: attendantId === OTHER_ATTENDANT ? INK : '#ffffff',
                                                borderColor: attendantId === OTHER_ATTENDANT ? INK : BORDER,
                                                color: attendantId === OTHER_ATTENDANT ? '#ffffff' : INK_MUTED,
                                            }}
                                        >
                                            Otro…
                                        </button>
                                    )}
                                </div>
                            )}

                            {showAttendantText && (
                                <input
                                    type="text"
                                    value={attendantName}
                                    onChange={e => { setAttendantName(e.target.value); setAttendantError(''); }}
                                    maxLength={120}
                                    autoComplete="off"
                                    placeholder="Escribe el nombre"
                                    className="w-full h-14 rounded-2xl border-2 px-4 text-base font-medium focus:outline-none"
                                    style={{ borderColor: attendantError ? '#dc2626' : BORDER, color: INK }}
                                />
                            )}

                            {attendantError && <p className="text-sm font-bold" style={{ color: '#dc2626' }}>{attendantError}</p>}
                        </div>
                    </section>
                )}

                {/* Comentario abierto: solo con calificaciones bajas */}
                {showComment && (
                    <section className="bg-white rounded-3xl border-2 p-5 sm:p-7 shadow-sm flex flex-col sm:flex-row gap-4" style={{ borderColor: BORDER }}>
                        <div className="h-14 w-14 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: INK }}>
                            <MessageCircle size={26} color="#ffffff" />
                        </div>
                        <div className="flex-1 flex flex-col gap-2">
                            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: INK }}>
                                {config.tituloComentario}
                            </h2>
                            {config.textoComentario && (
                                <p className="text-[15px] font-medium" style={{ color: INK_MUTED }}>{config.textoComentario}</p>
                            )}
                            <textarea
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                maxLength={1000}
                                rows={4}
                                placeholder="Escribe aquí..."
                                className="mt-1 w-full rounded-2xl border-2 p-4 text-base font-medium resize-y focus:outline-none"
                                style={{ borderColor: BORDER, color: INK }}
                            />
                        </div>
                    </section>
                )}

                {/* Regalo + correo + enviar */}
                <section className="bg-white rounded-3xl border-2 p-5 sm:p-7 shadow-sm flex flex-col gap-5" style={{ borderColor: BORDER }}>
                    {config.regaloActivo === 1 && (
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="h-14 w-14 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: INK }}>
                                <Gift size={26} color="#ffffff" />
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                                <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: INK }}>
                                    {config.tituloRegalo}
                                </h2>
                                {config.textoRegalo && (
                                    <p className="text-[15px] font-medium" style={{ color: INK_MUTED }}>{config.textoRegalo}</p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-2">
                                <label htmlFor="survey-phone" className="text-sm font-bold" style={{ color: INK }}>
                                    Teléfono
                                </label>
                                <div className="relative">
                                    <Phone size={20} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: INK_MUTED }} />
                                    <input
                                        id="survey-phone"
                                        type="tel"
                                        inputMode="tel"
                                        // Tablet compartida: sin autocompletar, o el navegador
                                        // sugeriría los datos de comensales anteriores.
                                        autoComplete="off"
                                        value={phone}
                                        onChange={e => { setPhone(e.target.value); setContactError(''); }}
                                        maxLength={20}
                                        placeholder="55 1234 5678"
                                        className="w-full h-14 rounded-2xl border-2 pl-12 pr-4 text-base font-medium focus:outline-none"
                                        style={{ borderColor: contactError ? '#dc2626' : BORDER, color: INK }}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="survey-email" className="text-sm font-bold" style={{ color: INK }}>
                                    Correo electrónico
                                </label>
                                <div className="relative">
                                    <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: INK_MUTED }} />
                                    <input
                                        id="survey-email"
                                        type="email"
                                        inputMode="email"
                                        autoComplete="off"
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setContactError(''); }}
                                        maxLength={255}
                                        placeholder="tuemail@correo.com"
                                        className="w-full h-14 rounded-2xl border-2 pl-12 pr-4 text-base font-medium focus:outline-none"
                                        style={{ borderColor: contactError ? '#dc2626' : BORDER, color: INK }}
                                    />
                                </div>
                            </div>
                        </div>
                        {config.regaloActivo === 1 && (
                            <p className="text-[13px] font-medium" style={{ color: INK_MUTED }}>
                                Déjanos al menos uno de los dos.
                            </p>
                        )}
                        {contactError && <p className="text-sm font-bold" style={{ color: '#dc2626' }}>{contactError}</p>}
                        {config.regaloActivo === 1 && (
                            <label className="flex items-center gap-3 mt-1 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={wantsPromos}
                                    onChange={e => setWantsPromos(e.target.checked)}
                                    className="h-5 w-5 rounded border-2 cursor-pointer"
                                    style={{ accentColor: INK, borderColor: INK }}
                                />
                                <span className="text-[15px] font-medium" style={{ color: INK }}>{config.textoPromos}</span>
                            </label>
                        )}
                    </div>

                    {submitError && (
                        <p className="text-sm font-bold text-center" style={{ color: '#dc2626' }}>{submitError}</p>
                    )}

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSending}
                        // Color inline, no `text-white`: button { color: inherit } global
                        // (sin capa) pisa la utilidad y el texto se perdía en el fondo.
                        className="w-full h-16 rounded-2xl font-black text-lg uppercase tracking-wide flex items-center justify-center gap-3 active:scale-[0.98] transition disabled:opacity-60 disabled:active:scale-100 shadow-sm"
                        style={{ backgroundColor: INK, color: '#ffffff' }}
                    >
                        {isSending ? <Loader2 size={24} className="animate-spin" /> : <Send size={22} strokeWidth={2.2} />}
                        {config.regaloActivo === 1 ? config.textoBotonEnviar : 'Enviar'}
                        {config.regaloActivo === 1 && <Gift size={22} strokeWidth={2.2} />}
                    </button>
                </section>
            </div>
        </main>
    );
}
