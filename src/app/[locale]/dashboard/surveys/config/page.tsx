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
};

const FALLBACK_MODULE_COLOR = '#6d28d9';
const SCALE = 5;

export default function SurveyConfigPage() {
    const moduleColor = useModuleColor() ?? FALLBACK_MODULE_COLOR;
    const { success, error: toastError } = useToast();
    const projectId = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('project') || '{}').idProyecto
        : null;

    const [questions, setQuestions] = useState<SurveyQuestionRow[]>([]);
    const [config, setConfig] = useState<SurveyConfigForm>(EMPTY_CONFIG);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
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
                    });
                }
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
            if (data.success) success('Configuración guardada');
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
                <PageCard
                    title="Textos de la encuesta"
                    actions={
                        <Button variant="solid" size="sm" leftIcon={Save} iconBox isLoading={isSavingConfig} onClick={handleSaveConfig}>
                            Guardar Textos
                        </Button>
                    }
                >
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

                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Regalo y correo</span>
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
                    </div>
                </PageCard>
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
