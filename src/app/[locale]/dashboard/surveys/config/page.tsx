'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    PenLine,
    Plus,
    Pencil,
    Trash2,
    ArrowUp,
    ArrowDown,
    Star,
    ListChecks,
    TabletSmartphone,
    Check,
    Save,
    Upload,
    QrCode,
} from 'lucide-react';
import PageShell, { PageCard } from '@/components/PageShell';
import Button from '@/components/Button';
import Input, { Select } from '@/components/Input';
import BaseModal from '@/components/BaseModal';
import ThemedGridHeader, {
    ThemedGridHeaderCell,
    TableBody,
    TableRow,
    TableCell,
    RowActionButton,
} from '@/components/ThemedGridHeader';
import { useToast } from '@/contexts/ToastContext';
import { useModuleColor } from '@/lib/use-module-color';
import SurveyLinkModal from '@/components/surveys/SurveyLinkModal';

/**
 * Configurador de la encuesta de satisfacción: preguntas (estrellas u
 * opciones), textos de la página pública y la liga para tablet.
 */

interface SurveyQuestionRow {
    IdPregunta: number;
    Pregunta: string;
    TipoPregunta: 'estrellas' | 'opciones';
    Etiquetas: string[];
    Orden: number;
    Activa: number;
}

interface SurveyConfigForm {
    Titulo: string;
    Subtitulo: string;
    Subtitulo2: string;
    UmbralComentario: number;
    TituloComentario: string;
    TextoComentario: string;
    RegaloActivo: number;
    TituloRegalo: string;
    TextoRegalo: string;
    TextoPromos: string;
    TextoBotonEnviar: string;
    TituloGracias: string;
    TextoGracias: string;
    AtencionActiva: number;
    AtencionTitulo: string;
    AtencionTexto: string;
    AtencionModo: 'lista' | 'texto' | 'ambos';
    AtencionObligatoria: number;
    /** Data URL del flyer; vacío = sin flyer (la tablet no muestra QR). */
    FlyerImagen: string;
    FlyerNombre: string;
}

/** Persona de la lista predefinida de "¿Quién te atendió?". */
interface SurveyAttendantRow {
    IdAtendio: number;
    Nombre: string;
    Orden: number;
    Activo: number;
}

const EMPTY_CONFIG: SurveyConfigForm = {
    Titulo: '',
    Subtitulo: '',
    Subtitulo2: '',
    UmbralComentario: 3,
    TituloComentario: '',
    TextoComentario: '',
    RegaloActivo: 1,
    TituloRegalo: '',
    TextoRegalo: '',
    TextoPromos: '',
    TextoBotonEnviar: '',
    TituloGracias: '',
    TextoGracias: '',
    AtencionActiva: 0,
    AtencionTitulo: '',
    AtencionTexto: '',
    AtencionModo: 'lista',
    AtencionObligatoria: 0,
    FlyerImagen: '',
    FlyerNombre: '',
};

/** Tope del archivo del flyer (el servidor rechaza ~4 MB de imagen). */
const MAX_FLYER_FILE_BYTES = 4 * 1024 * 1024;

/** Textos con los que se estrena el bloque al encenderlo por primera vez. */
const DEFAULT_ATENCION_TITULO = '¿Quién te atendió?';
const DEFAULT_ATENCION_TEXTO = 'Nos ayuda a reconocer a nuestro equipo.';

const FALLBACK_MODULE_COLOR = '#6d28d9';
const SCALE = 5;

export default function SurveyConfigPage() {
    const moduleColor = useModuleColor() ?? FALLBACK_MODULE_COLOR;
    const { success, error: toastError } = useToast();
    const projectId = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('project') || '{}').idProyecto
        : null;

    const [questions, setQuestions] = useState<SurveyQuestionRow[]>([]);
    const [attendants, setAttendants] = useState<SurveyAttendantRow[]>([]);
    const [newAttendant, setNewAttendant] = useState('');
    const [renamingAttendant, setRenamingAttendant] = useState<{ id: number; nombre: string } | null>(null);
    const [config, setConfig] = useState<SurveyConfigForm>(EMPTY_CONFIG);
    // Sin carga exitosa no se permite guardar textos: guardaría el formulario
    // vacío encima de lo que el proyecto ya tiene configurado.
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    // Cambios de config sin guardar. Preguntas y personas NO cuentan: esas se
    // guardan solas al momento contra su propio endpoint.
    const [isDirty, setIsDirty] = useState(false);
    const [isLinkOpen, setIsLinkOpen] = useState(false);

    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<SurveyQuestionRow | null>(null);
    const [qText, setQText] = useState('');
    const [qType, setQType] = useState<'estrellas' | 'opciones'>('estrellas');
    const [qLabels, setQLabels] = useState<string[]>(Array(SCALE).fill(''));
    const [qActive, setQActive] = useState(true);
    const [qError, setQError] = useState('');
    const [isSavingQuestion, setIsSavingQuestion] = useState(false);

    const fetchAll = useCallback(async () => {
        if (!projectId) return;
        try {
            const res = await fetch(`/api/surveys/questions?projectId=${projectId}`);
            const data = await res.json();
            if (data.success) {
                setQuestions(data.questions || []);
                setIsConfigLoaded(true);
                if (data.config) {
                    setConfig({
                        Titulo: data.config.Titulo || '',
                        Subtitulo: data.config.Subtitulo || '',
                        Subtitulo2: data.config.Subtitulo2 || '',
                        UmbralComentario: Number.isInteger(data.config.UmbralComentario)
                            ? data.config.UmbralComentario
                            : 3,
                        TituloComentario: data.config.TituloComentario || '',
                        TextoComentario: data.config.TextoComentario || '',
                        RegaloActivo: data.config.RegaloActivo === 0 ? 0 : 1,
                        TituloRegalo: data.config.TituloRegalo || '',
                        TextoRegalo: data.config.TextoRegalo || '',
                        TextoPromos: data.config.TextoPromos || '',
                        TextoBotonEnviar: data.config.TextoBotonEnviar || '',
                        TituloGracias: data.config.TituloGracias || '',
                        TextoGracias: data.config.TextoGracias || '',
                        AtencionActiva: data.config.AtencionActiva === 1 ? 1 : 0,
                        AtencionTitulo: data.config.AtencionTitulo || '',
                        AtencionTexto: data.config.AtencionTexto || '',
                        FlyerImagen: data.config.FlyerImagen || '',
                        FlyerNombre: data.config.FlyerNombre || '',
                        AtencionModo: data.config.AtencionModo === 'texto' || data.config.AtencionModo === 'ambos'
                            ? data.config.AtencionModo
                            : 'lista',
                        AtencionObligatoria: data.config.AtencionObligatoria === 1 ? 1 : 0,
                    });
                }
                setAttendants(data.attendants || []);
                setIsDirty(false);
            }
        } catch (error) {
            console.error('Error fetching survey config:', error);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    /* ── Preguntas ──────────────────────────────────────────────────────── */

    const openNewQuestion = () => {
        setEditingQuestion(null);
        setQText('');
        setQType('estrellas');
        setQLabels(Array(SCALE).fill(''));
        setQActive(true);
        setQError('');
        setIsQuestionModalOpen(true);
    };

    const openEditQuestion = (question: SurveyQuestionRow) => {
        setEditingQuestion(question);
        setQText(question.Pregunta);
        setQType(question.TipoPregunta);
        const labels = Array(SCALE).fill('');
        question.Etiquetas.forEach((label, i) => { if (i < SCALE) labels[i] = label; });
        setQLabels(labels);
        setQActive(question.Activa === 1);
        setQError('');
        setIsQuestionModalOpen(true);
    };

    const handleSaveQuestion = async () => {
        const pregunta = qText.trim();
        if (!pregunta) {
            setQError('Escribe la pregunta.');
            return;
        }
        const etiquetas = qLabels.map(l => l.trim());
        if (qType === 'opciones' && etiquetas.filter(Boolean).length < 2) {
            setQError('Una pregunta de opciones necesita al menos 2 opciones.');
            return;
        }
        setQError('');
        setIsSavingQuestion(true);
        try {
            const res = await fetch('/api/surveys/questions', {
                method: editingQuestion ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    idPregunta: editingQuestion?.IdPregunta,
                    pregunta,
                    tipo: qType,
                    etiquetas,
                    activa: qActive ? 1 : 0,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setIsQuestionModalOpen(false);
                fetchAll();
                success(editingQuestion ? 'Pregunta actualizada' : 'Pregunta agregada');
            } else {
                toastError(data.message || 'No se pudo guardar la pregunta');
            }
        } catch (error) {
            console.error('Error saving question:', error);
            toastError('No se pudo guardar la pregunta');
        } finally {
            setIsSavingQuestion(false);
        }
    };

    const handleToggleActive = async (question: SurveyQuestionRow) => {
        const nextActive = question.Activa === 1 ? 0 : 1;
        setQuestions(prev => prev.map(q =>
            q.IdPregunta === question.IdPregunta ? { ...q, Activa: nextActive } : q
        ));
        try {
            const res = await fetch('/api/surveys/questions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    idPregunta: question.IdPregunta,
                    soloActiva: true,
                    activa: nextActive,
                }),
            });
            const data = await res.json();
            if (!data.success) {
                toastError(data.message || 'No se pudo cambiar la pregunta');
                fetchAll();
            }
        } catch (error) {
            console.error('Error toggling question:', error);
            fetchAll();
        }
    };

    const handleMove = async (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= questions.length) return;
        const reordered = [...questions];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        setQuestions(reordered);
        try {
            const res = await fetch('/api/surveys/questions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, order: reordered.map(q => q.IdPregunta) }),
            });
            const data = await res.json();
            if (!data.success) fetchAll();
        } catch (error) {
            console.error('Error reordering questions:', error);
            fetchAll();
        }
    };

    const handleDelete = async (question: SurveyQuestionRow) => {
        const confirmed = window.confirm(
            `¿Eliminar la pregunta "${question.Pregunta}"? Las respuestas ya capturadas se conservan en el reporte.`
        );
        if (!confirmed) return;
        try {
            const res = await fetch(
                `/api/surveys/questions?projectId=${projectId}&idPregunta=${question.IdPregunta}`,
                { method: 'DELETE' }
            );
            const data = await res.json();
            if (data.success) {
                fetchAll();
                success('Pregunta eliminada');
            } else {
                toastError(data.message || 'No se pudo eliminar la pregunta');
            }
        } catch (error) {
            console.error('Error deleting question:', error);
            toastError('No se pudo eliminar la pregunta');
        }
    };

    /* ── Quién atendió ──────────────────────────────────────────────────── */

    /** Llama al API de la lista y recarga; devuelve si salió bien. */
    const runAttendant = async (input: RequestInfo, init?: RequestInit) => {
        try {
            const res = await fetch(input, init);
            const data = await res.json();
            if (!data.success) {
                toastError(data.message || 'No se pudo actualizar la lista');
                return false;
            }
            await fetchAll();
            return true;
        } catch (error) {
            console.error('Error updating attendants:', error);
            toastError('No se pudo actualizar la lista');
            return false;
        }
    };

    const handleAddAttendant = async () => {
        const nombre = newAttendant.trim();
        if (!nombre) return;
        const ok = await runAttendant('/api/surveys/attendants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, nombre }),
        });
        if (ok) setNewAttendant('');
    };

    const handleRenameAttendant = async () => {
        if (!renamingAttendant || !renamingAttendant.nombre.trim()) return;
        const ok = await runAttendant('/api/surveys/attendants', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, idAtendio: renamingAttendant.id, nombre: renamingAttendant.nombre.trim() }),
        });
        if (ok) setRenamingAttendant(null);
    };

    const handleToggleAttendant = async (person: SurveyAttendantRow) => {
        await runAttendant('/api/surveys/attendants', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, idAtendio: person.IdAtendio, activo: person.Activo === 1 ? 0 : 1 }),
        });
    };

    const handleDeleteAttendant = async (person: SurveyAttendantRow) => {
        const confirmed = window.confirm(
            `¿Eliminar a "${person.Nombre}" de la lista? Las encuestas ya contestadas conservan su nombre en el reporte.`
        );
        if (!confirmed) return;
        await runAttendant(
            `/api/surveys/attendants?projectId=${projectId}&idAtendio=${person.IdAtendio}`,
            { method: 'DELETE' }
        );
    };

    /* ── Textos ─────────────────────────────────────────────────────────── */

    const handleSaveConfig = async () => {
        setIsSavingConfig(true);
        try {
            const res = await fetch('/api/surveys/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, config }),
            });
            const data = await res.json();
            if (data.success) { success('Configuración guardada'); setIsDirty(false); }
            else toastError(data.message || 'No se pudo guardar la configuración');
        } catch (error) {
            console.error('Error saving survey config:', error);
            toastError('No se pudo guardar la configuración');
        } finally {
            setIsSavingConfig(false);
        }
    };

    const setConfigField = (field: keyof SurveyConfigForm, value: string | number) => {
        setConfig(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    // El flyer viaja como data URL dentro de la config (mismo mecanismo que el
    // logo del proyecto) y se guarda con el botón Guardar todo del final.
    const handleFlyerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toastError('El flyer debe ser una imagen (PNG, JPG, WEBP o GIF)');
            return;
        }
        if (file.size > MAX_FLYER_FILE_BYTES) {
            toastError('El flyer es demasiado grande: máximo 4 MB');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setConfig(prev => ({
                ...prev,
                FlyerImagen: reader.result as string,
                FlyerNombre: file.name.slice(0, 245),
            }));
            setIsDirty(true);
        };
        reader.readAsDataURL(file);
    };

    const typeLabel = (tipo: 'estrellas' | 'opciones') =>
        tipo === 'estrellas' ? 'Estrellas 1-5' : 'Opciones';

    return (
        <PageShell
            title="Configurar Encuesta"
            subtitle="Preguntas y textos de la encuesta de satisfacción"
            icon={PenLine}
            actions={
                <>
                    <Button variant="secondary" size="md" leftIcon={Plus} onClick={openNewQuestion}>
                        Nueva Pregunta
                    </Button>
                    <Button variant="solid" size="md" leftIcon={TabletSmartphone} iconBox onClick={() => setIsLinkOpen(true)}>
                        Liga para Tablet
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                {/* Preguntas */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse">
                            <ThemedGridHeader accentColor={moduleColor}>
                                <ThemedGridHeaderCell className="w-20" align="center">Orden</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>Pregunta</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="center">Tipo</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>Etiquetas</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="center">Activa</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="right">Acciones</ThemedGridHeaderCell>
                            </ThemedGridHeader>
                            <TableBody
                                loading={isLoading}
                                empty={!isLoading && questions.length === 0}
                                emptyMessage="Sin preguntas. Agrega la primera con el botón Nueva Pregunta."
                                colSpan={6}
                            >
                                {questions.map((question, index) => (
                                    <TableRow key={question.IdPregunta} className={question.Activa === 0 ? 'opacity-50' : ''}>
                                        <TableCell align="center">
                                            <div className="flex items-center justify-center gap-0.5">
                                                <RowActionButton
                                                    icon={ArrowUp}
                                                    label="Subir"
                                                    onClick={() => handleMove(index, -1)}
                                                    disabled={index === 0}
                                                />
                                                <span className="text-xs font-bold text-gray-500 w-5 text-center">{index + 1}</span>
                                                <RowActionButton
                                                    icon={ArrowDown}
                                                    label="Bajar"
                                                    onClick={() => handleMove(index, 1)}
                                                    disabled={index === questions.length - 1}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-semibold text-gray-800">{question.Pregunta}</span>
                                        </TableCell>
                                        <TableCell align="center">
                                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                                {question.TipoPregunta === 'estrellas'
                                                    ? <Star size={11} />
                                                    : <ListChecks size={11} />}
                                                {typeLabel(question.TipoPregunta)}
                                            </span>
                                        </TableCell>
                                        <TableCell muted>
                                            {question.Etiquetas.filter(Boolean).join(' · ') || '—'}
                                        </TableCell>
                                        <TableCell align="center">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleActive(question)}
                                                aria-label={question.Activa === 1 ? 'Desactivar pregunta' : 'Activar pregunta'}
                                                className={`inline-flex h-6 w-11 items-center rounded-full transition-colors ${question.Activa === 1 ? '' : 'bg-gray-200'}`}
                                                style={question.Activa === 1 ? { backgroundColor: moduleColor } : undefined}
                                            >
                                                <span className={`h-5 w-5 rounded-full bg-white shadow transform transition-transform ${question.Activa === 1 ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                            </button>
                                        </TableCell>
                                        <TableCell align="right">
                                            <div className="flex items-center justify-end gap-1">
                                                <RowActionButton icon={Pencil} label="Editar" variant="edit" onClick={() => openEditQuestion(question)} />
                                                <RowActionButton icon={Trash2} label="Eliminar" variant="delete" onClick={() => handleDelete(question)} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </table>
                    </div>
                    {!isLoading && questions.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
                            <span className="text-xs text-gray-400">
                                {questions.length} pregunta{questions.length === 1 ? '' : 's'} · las inactivas no aparecen en la tablet
                            </span>
                        </div>
                    )}
                </div>

                {/* Textos de la página pública */}
                <PageCard title="Textos de la encuesta">
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <Input
                                label="Título"
                                value={config.Titulo}
                                onChange={e => setConfigField('Titulo', e.target.value)}
                                maxLength={300}
                            />
                            <Input
                                label="Subtítulo"
                                value={config.Subtitulo}
                                onChange={e => setConfigField('Subtitulo', e.target.value)}
                                maxLength={300}
                            />
                            <Input
                                label="Segunda línea"
                                value={config.Subtitulo2}
                                onChange={e => setConfigField('Subtitulo2', e.target.value)}
                                maxLength={300}
                            />
                        </div>

                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Comentario abierto</span>
                            </div>
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <Select
                                    label="Pedir comentario cuando califiquen con"
                                    value={config.UmbralComentario}
                                    onChange={e => setConfigField('UmbralComentario', Number(e.target.value))}
                                    hint="La caja de comentario aparece si alguna respuesta cae en ese rango."
                                >
                                    <option value={0}>Nunca</option>
                                    <option value={1}>1</option>
                                    <option value={2}>1 o 2</option>
                                    <option value={3}>1, 2 o 3</option>
                                    <option value={4}>4 o menos</option>
                                    <option value={5}>Siempre</option>
                                </Select>
                                <Input
                                    label="Título del comentario"
                                    value={config.TituloComentario}
                                    onChange={e => setConfigField('TituloComentario', e.target.value)}
                                    maxLength={300}
                                />
                                <Input
                                    label="Texto del comentario"
                                    value={config.TextoComentario}
                                    onChange={e => setConfigField('TextoComentario', e.target.value)}
                                    maxLength={300}
                                />
                            </div>
                        </div>

                        {/* ¿Quién te atendió?: lista predefinida y/o texto abierto */}
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Quién atendió</span>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={config.AtencionActiva === 1}
                                        onChange={e => {
                                            const activa = e.target.checked ? 1 : 0;
                                            // Al encenderlo por primera vez estrena textos: guardar
                                            // el bloque en blanco dejaría la encuesta sin título.
                                            setConfig(prev => ({
                                                ...prev,
                                                AtencionActiva: activa,
                                                AtencionTitulo: activa && !prev.AtencionTitulo ? DEFAULT_ATENCION_TITULO : prev.AtencionTitulo,
                                                AtencionTexto: activa && !prev.AtencionTexto ? DEFAULT_ATENCION_TEXTO : prev.AtencionTexto,
                                            }));
                                            setIsDirty(true);
                                        }}
                                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-gray-300 cursor-pointer"
                                    />
                                    <span className="text-xs font-semibold text-gray-600">Preguntar quién atendió</span>
                                </label>
                            </div>
                            <div className="p-4 flex flex-col gap-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <Input
                                        label="Título"
                                        value={config.AtencionTitulo}
                                        onChange={e => setConfigField('AtencionTitulo', e.target.value)}
                                        maxLength={300}
                                        disabled={config.AtencionActiva === 0}
                                    />
                                    <Input
                                        label="Texto de apoyo"
                                        value={config.AtencionTexto}
                                        onChange={e => setConfigField('AtencionTexto', e.target.value)}
                                        maxLength={300}
                                        disabled={config.AtencionActiva === 0}
                                    />
                                    <Select
                                        label="Cómo se contesta"
                                        value={config.AtencionModo}
                                        onChange={e => setConfigField('AtencionModo', e.target.value)}
                                        disabled={config.AtencionActiva === 0}
                                        hint="La lista predefinida evita nombres mal escritos."
                                    >
                                        <option value="lista">Solo lista predefinida</option>
                                        <option value="texto">Solo texto abierto</option>
                                        <option value="ambos">Lista con opción &quot;Otro&quot;</option>
                                    </Select>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={config.AtencionObligatoria === 1}
                                                onChange={e => setConfigField('AtencionObligatoria', e.target.checked ? 1 : 0)}
                                                disabled={config.AtencionActiva === 0}
                                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-gray-300 cursor-pointer disabled:opacity-50"
                                            />
                                            <span className="text-xs font-semibold text-gray-600">Obligatorio</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Lista predefinida: solo estorba en modo texto abierto. */}
                                {config.AtencionModo !== 'texto' && (
                                    <div className={config.AtencionActiva === 0 ? 'opacity-50 pointer-events-none' : ''}>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                            Personas ({attendants.filter(a => a.Activo === 1).length} activas)
                                        </p>
                                        <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden max-h-64 overflow-y-auto">
                                            {attendants.length === 0 && (
                                                <li className="px-3 py-3 text-center text-xs text-gray-500">
                                                    Sin personas. Agrega la primera abajo.
                                                </li>
                                            )}
                                            {attendants.map(person => (
                                                <li key={person.IdAtendio} className="px-3 py-2 bg-white flex items-center gap-2">
                                                    {renamingAttendant?.id === person.IdAtendio ? (
                                                        <>
                                                            <input
                                                                value={renamingAttendant.nombre}
                                                                onChange={e => setRenamingAttendant({ ...renamingAttendant, nombre: e.target.value })}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleRenameAttendant();
                                                                    if (e.key === 'Escape') setRenamingAttendant(null);
                                                                }}
                                                                autoFocus
                                                                maxLength={120}
                                                                className="flex-1 h-9 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-gray-900"
                                                            />
                                                            <RowActionButton icon={Check} label="Guardar" onClick={handleRenameAttendant} />
                                                            <RowActionButton icon={Trash2} label="Cancelar" onClick={() => setRenamingAttendant(null)} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className={`flex-1 text-sm font-semibold truncate ${person.Activo === 1 ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                                                                {person.Nombre}
                                                            </span>
                                                            <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={person.Activo === 1}
                                                                    onChange={() => handleToggleAttendant(person)}
                                                                    className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-gray-300 cursor-pointer"
                                                                />
                                                                <span className="text-[11px] font-semibold text-gray-500">Activa</span>
                                                            </label>
                                                            <RowActionButton
                                                                icon={Pencil}
                                                                label="Cambiar nombre"
                                                                variant="edit"
                                                                onClick={() => setRenamingAttendant({ id: person.IdAtendio, nombre: person.Nombre })}
                                                            />
                                                            <RowActionButton
                                                                icon={Trash2}
                                                                label="Eliminar"
                                                                variant="delete"
                                                                onClick={() => handleDeleteAttendant(person)}
                                                            />
                                                        </>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="flex items-center gap-2 mt-2">
                                            <input
                                                value={newAttendant}
                                                onChange={e => setNewAttendant(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') handleAddAttendant(); }}
                                                placeholder="Nombre (ej. Ana G.)"
                                                maxLength={120}
                                                className="flex-1 h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-gray-900"
                                            />
                                            <Button leftIcon={Plus} onClick={handleAddAttendant} size="sm" variant="secondary" disabled={!newAttendant.trim()}>
                                                Agregar
                                            </Button>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                                            Desactivar a alguien lo quita de la tablet sin borrar su historial. La lista se guarda al
                                            momento; el resto de este bloque, con el botón Guardar.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Regalo y contacto</span>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={config.RegaloActivo === 1}
                                        onChange={e => setConfigField('RegaloActivo', e.target.checked ? 1 : 0)}
                                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-gray-300 cursor-pointer"
                                    />
                                    <span className="text-xs font-semibold text-gray-600">Ofrecer regalo por contestar</span>
                                </label>
                            </div>
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="Título del regalo"
                                    value={config.TituloRegalo}
                                    onChange={e => setConfigField('TituloRegalo', e.target.value)}
                                    maxLength={300}
                                    disabled={config.RegaloActivo === 0}
                                />
                                <Input
                                    label="Texto del regalo"
                                    value={config.TextoRegalo}
                                    onChange={e => setConfigField('TextoRegalo', e.target.value)}
                                    maxLength={300}
                                    disabled={config.RegaloActivo === 0}
                                />
                                <Input
                                    label="Texto del check de promociones"
                                    value={config.TextoPromos}
                                    onChange={e => setConfigField('TextoPromos', e.target.value)}
                                    maxLength={300}
                                    disabled={config.RegaloActivo === 0}
                                />
                                <Input
                                    label="Texto del botón de enviar"
                                    value={config.TextoBotonEnviar}
                                    onChange={e => setConfigField('TextoBotonEnviar', e.target.value)}
                                    maxLength={300}
                                    disabled={config.RegaloActivo === 0}
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Agradecimiento</span>
                            </div>
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="Título de gracias"
                                    value={config.TituloGracias}
                                    onChange={e => setConfigField('TituloGracias', e.target.value)}
                                    maxLength={300}
                                />
                                <Input
                                    label="Texto de gracias"
                                    value={config.TextoGracias}
                                    onChange={e => setConfigField('TextoGracias', e.target.value)}
                                    maxLength={300}
                                />
                            </div>
                        </div>

                        {/* Flyer de promoción: QR en la pantalla de gracias */}
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                <QrCode size={14} className="text-gray-500" />
                                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Flyer de promoción</span>
                            </div>
                            <div className="p-4 flex flex-col sm:flex-row gap-4">
                                <div className="flex-1 space-y-2">
                                    <p className="text-sm text-gray-600 leading-relaxed">
                                        Sube la imagen de tu promoción. Al terminar la encuesta se muestra un
                                        <strong> código QR</strong> para escanearlo con el celular y un
                                        <strong> botón</strong> que abre este flyer para reclamar el regalo.
                                        Sin flyer, la pantalla de gracias no muestra ninguno de los dos.
                                    </p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            leftIcon={Upload}
                                            onClick={() => document.getElementById('flyer-input')?.click()}
                                        >
                                            {config.FlyerImagen ? 'Cambiar Flyer' : 'Subir Flyer'}
                                        </Button>
                                        {config.FlyerImagen && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                leftIcon={Trash2}
                                                onClick={() => { setConfig(prev => ({ ...prev, FlyerImagen: '', FlyerNombre: '' })); setIsDirty(true); }}
                                            >
                                                Quitar
                                            </Button>
                                        )}
                                        <input
                                            id="flyer-input"
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,image/gif"
                                            onChange={handleFlyerUpload}
                                            className="hidden"
                                        />
                                    </div>
                                    {config.FlyerNombre && (
                                        <p className="text-[11px] text-gray-400">{config.FlyerNombre}</p>
                                    )}
                                    <p className="text-[11px] text-gray-400">
                                        Imagen PNG, JPG, WEBP o GIF de hasta 4 MB. Se aplica al presionar Guardar todo.
                                    </p>
                                </div>
                                {config.FlyerImagen && (
                                    <div className="w-full sm:w-44 shrink-0">
                                        <div className="rounded-xl border-2 border-gray-200 overflow-hidden bg-gray-50">
                                            <img
                                                src={config.FlyerImagen}
                                                alt="Vista previa del flyer"
                                                className="w-full h-auto block"
                                            />
                                        </div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center mt-1">
                                            Vista previa
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </PageCard>

                {/* Guardar todo: cierra la página porque es lo último que se
                    hace tras repasar los bloques de arriba. Solo se enciende
                    cuando hay algo pendiente; mientras hay cambios sin guardar
                    se queda pegado al borde inferior para no obligar a
                    regresar hasta acá desde cualquier campo. */}
                <div
                    className={`flex items-center justify-between gap-3 flex-wrap rounded-xl border bg-white px-4 py-3 ${
                        isDirty ? 'sticky bottom-3 z-20 border-amber-300 shadow-lg' : 'border-gray-200 shadow-sm'
                    }`}
                >
                    <p className="text-xs text-gray-500">
                        {isDirty
                            ? 'Hay cambios sin guardar en los textos, el bloque de atención o el flyer.'
                            : 'Todo guardado. Las preguntas y la lista de personas se guardan al momento.'}
                    </p>
                    <Button
                        variant="solid"
                        size="md"
                        leftIcon={Save}
                        iconBox
                        isLoading={isSavingConfig}
                        disabled={!isConfigLoaded || !isDirty}
                        onClick={handleSaveConfig}
                    >
                        Guardar todo
                    </Button>
                </div>
            </div>

            {/* Modal de pregunta */}
            <BaseModal
                isOpen={isQuestionModalOpen}
                onClose={() => setIsQuestionModalOpen(false)}
                title={editingQuestion ? 'Editar Pregunta' : 'Nueva Pregunta'}
                subtitle={editingQuestion ? `Pregunta #${editingQuestion.IdPregunta}` : 'Se agrega al final de la encuesta'}
                size="lg"
                accentColor={moduleColor}
                footer={
                    <div className="flex items-center justify-end gap-2.5">
                        <Button variant="secondary" size="md" onClick={() => setIsQuestionModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="solid" size="md" leftIcon={Check} iconBox isLoading={isSavingQuestion} onClick={handleSaveQuestion}>
                            {editingQuestion ? 'Actualizar Pregunta' : 'Agregar Pregunta'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="Pregunta"
                        value={qText}
                        onChange={e => setQText(e.target.value)}
                        maxLength={255}
                        placeholder="¿Cómo calificarías…?"
                        error={qError && !qText.trim() ? qError : undefined}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Select
                            label="Tipo de respuesta"
                            value={qType}
                            onChange={e => setQType(e.target.value as 'estrellas' | 'opciones')}
                        >
                            <option value="estrellas">Estrellas (1 a 5)</option>
                            <option value="opciones">Opciones múltiples</option>
                        </Select>
                        <div className="flex items-end pb-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={qActive}
                                    onChange={e => setQActive(e.target.checked)}
                                    className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-gray-300 cursor-pointer"
                                />
                                <span className="text-sm font-semibold text-gray-700">Pregunta activa</span>
                            </label>
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                                {qType === 'estrellas' ? 'Etiquetas bajo cada estrella (opcional)' : 'Opciones (de mejor a peor)'}
                            </span>
                        </div>
                        <div className="p-4">
                            <div className={`grid gap-3 ${qType === 'estrellas' ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                {qLabels.map((label, i) => (
                                    <Input
                                        key={i}
                                        label={qType === 'estrellas' ? `${i + 1} ★` : `Opción ${i + 1}`}
                                        value={label}
                                        onChange={e => {
                                            const next = [...qLabels];
                                            next[i] = e.target.value;
                                            setQLabels(next);
                                        }}
                                        maxLength={60}
                                        placeholder={qType === 'estrellas' ? 'Solo número' : i < 2 ? 'Obligatoria' : 'Opcional'}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-3">
                                {qType === 'estrellas'
                                    ? 'Si dejas una etiqueta vacía, bajo esa estrella solo se muestra el número.'
                                    : 'La primera opción es la mejor calificación (vale 5) y la última la peor. Las opciones vacías se descartan; mínimo 2.'}
                            </p>
                            {qError && qText.trim() && (
                                <p className="text-xs text-red-500 font-medium mt-2">{qError}</p>
                            )}
                        </div>
                    </div>
                </div>
            </BaseModal>

            <SurveyLinkModal
                isOpen={isLinkOpen}
                onClose={() => setIsLinkOpen(false)}
                projectId={projectId}
                accentColor={moduleColor}
            />
        </PageShell>
    );
}
