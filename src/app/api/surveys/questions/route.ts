import { NextRequest, NextResponse } from 'next/server';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';
import {
    parseQuestionLabels,
    sanitizeQuestionLabels,
    sanitizeSurveyText,
    SURVEY_QUESTION_TYPES,
    MAX_QUESTION_LEN,
    MAX_SURVEY_QUESTIONS,
    SurveyQuestionType,
} from '@/lib/surveys';

/**
 * Administración de preguntas de la encuesta (portal autenticado).
 * GET devuelve también la configuración de textos para que la página de
 * configuración arme todo con una sola llamada.
 */
export async function GET(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        const [configRows] = await connection.query<RowDataPacket[]>(
            'SELECT * FROM tblEncuestasConfig ORDER BY IdConfig ASC LIMIT 1'
        );

        const [questionRows] = await connection.query<RowDataPacket[]>(
            `SELECT IdPregunta, Pregunta, TipoPregunta, Etiquetas, Orden, Activa
             FROM tblEncuestasPreguntas
             ORDER BY Orden ASC, IdPregunta ASC`
        );

        return NextResponse.json({
            success: true,
            config: configRows[0] || null,
            questions: questionRows.map(q => ({
                IdPregunta: q.IdPregunta,
                Pregunta: q.Pregunta,
                TipoPregunta: q.TipoPregunta === 'opciones' ? 'opciones' : 'estrellas',
                Etiquetas: parseQuestionLabels(q.Etiquetas),
                Orden: q.Orden,
                Activa: q.Activa,
            })),
        });
    } catch (error) {
        console.error('Error fetching survey questions:', error);
        return NextResponse.json({ success: false, message: 'Error al cargar las preguntas' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

interface QuestionPayload {
    pregunta: string | null;
    tipo: SurveyQuestionType;
    etiquetas: string[];
    activa: number;
}

function parseQuestionPayload(body: Record<string, unknown>): QuestionPayload | null {
    const pregunta = sanitizeSurveyText(body.pregunta, MAX_QUESTION_LEN);
    if (!pregunta) return null;

    const tipo: SurveyQuestionType = SURVEY_QUESTION_TYPES.includes(body.tipo as SurveyQuestionType)
        ? (body.tipo as SurveyQuestionType)
        : 'estrellas';

    const etiquetas = sanitizeQuestionLabels(body.etiquetas, tipo);
    // Una pregunta de opciones sin al menos 2 opciones no se puede contestar.
    if (tipo === 'opciones' && etiquetas.length < 2) return null;

    return { pregunta, tipo, etiquetas, activa: body.activa === 0 || body.activa === false ? 0 : 1 };
}

export async function POST(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const body = await request.json();
        const { projectId } = body;
        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const payload = parseQuestionPayload(body);
        if (!payload) {
            return NextResponse.json({ success: false, message: 'Pregunta inválida' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        const [countRows] = await connection.query<RowDataPacket[]>(
            'SELECT COUNT(*) AS Total FROM tblEncuestasPreguntas'
        );
        if (countRows[0].Total >= MAX_SURVEY_QUESTIONS) {
            return NextResponse.json(
                { success: false, message: `Máximo ${MAX_SURVEY_QUESTIONS} preguntas por encuesta` },
                { status: 400 }
            );
        }

        const [ordenRows] = await connection.query<RowDataPacket[]>(
            'SELECT COALESCE(MAX(Orden), -1) + 1 AS Siguiente FROM tblEncuestasPreguntas'
        );

        const [inserted] = await connection.query<ResultSetHeader>(
            `INSERT INTO tblEncuestasPreguntas (Pregunta, TipoPregunta, Etiquetas, Orden, Activa, FechaAct)
             VALUES (?, ?, ?, ?, ?, Now())`,
            [payload.pregunta, payload.tipo, JSON.stringify(payload.etiquetas), ordenRows[0].Siguiente, payload.activa]
        );

        return NextResponse.json({ success: true, idPregunta: inserted.insertId });
    } catch (error) {
        console.error('Error creating survey question:', error);
        return NextResponse.json({ success: false, message: 'Error al guardar la pregunta' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

/**
 * PUT edita una pregunta ({idPregunta, ...campos}) o reordena todas
 * ({order: [idPregunta en el orden deseado]}).
 */
export async function PUT(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const body = await request.json();
        const { projectId } = body;
        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        if (Array.isArray(body.order)) {
            const ids = body.order.map(Number).filter((id: number) => Number.isInteger(id) && id > 0);
            await connection.beginTransaction();
            try {
                for (const [index, id] of ids.entries()) {
                    await connection.query(
                        'UPDATE tblEncuestasPreguntas SET Orden = ?, FechaAct = Now() WHERE IdPregunta = ?',
                        [index, id]
                    );
                }
                await connection.commit();
            } catch (error) {
                await connection.rollback();
                throw error;
            }
            return NextResponse.json({ success: true });
        }

        const idPregunta = Number(body.idPregunta);
        if (!Number.isInteger(idPregunta) || idPregunta <= 0) {
            return NextResponse.json({ success: false, message: 'Pregunta no encontrada' }, { status: 400 });
        }

        // Cambio rápido de visibilidad sin mandar el resto de los campos.
        if (body.soloActiva === true) {
            await connection.query(
                'UPDATE tblEncuestasPreguntas SET Activa = ?, FechaAct = Now() WHERE IdPregunta = ?',
                [body.activa === 0 || body.activa === false ? 0 : 1, idPregunta]
            );
            return NextResponse.json({ success: true });
        }

        const payload = parseQuestionPayload(body);
        if (!payload) {
            return NextResponse.json({ success: false, message: 'Pregunta inválida' }, { status: 400 });
        }

        await connection.query(
            `UPDATE tblEncuestasPreguntas
             SET Pregunta = ?, TipoPregunta = ?, Etiquetas = ?, Activa = ?, FechaAct = Now()
             WHERE IdPregunta = ?`,
            [payload.pregunta, payload.tipo, JSON.stringify(payload.etiquetas), payload.activa, idPregunta]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating survey question:', error);
        return NextResponse.json({ success: false, message: 'Error al actualizar la pregunta' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

/**
 * Borra la pregunta. Las respuestas históricas no se tocan: el detalle guarda
 * snapshot del texto, así que el reporte de fechas pasadas sigue completo.
 */
export async function DELETE(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const idPregunta = Number(searchParams.get('idPregunta'));
        if (!projectIdStr || !Number.isInteger(idPregunta) || idPregunta <= 0) {
            return NextResponse.json({ success: false, message: 'Parámetros inválidos' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));
        await connection.query('DELETE FROM tblEncuestasPreguntas WHERE IdPregunta = ?', [idPregunta]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting survey question:', error);
        return NextResponse.json({ success: false, message: 'Error al eliminar la pregunta' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
