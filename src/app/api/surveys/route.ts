import { NextRequest, NextResponse } from 'next/server';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';
import {
    resolveSurveyUuid,
    parseQuestionLabels,
    maxValueForQuestion,
    labelForValue,
    sanitizeSurveyComment,
    sanitizeSurveyText,
    isValidSurveyEmail,
    MAX_SURVEY_QUESTIONS,
    MAX_EMAIL_LEN,
    SurveyQuestionType,
} from '@/lib/surveys';

/**
 * Recepción de una encuesta contestada.
 *
 * ENDPOINT SIN AUTENTICACIÓN: la única credencial es el UUID del cuerpo.
 * Todo lo demás se revalida contra la BD del proyecto: las preguntas y sus
 * rangos salen de tblEncuestasPreguntas (nunca del request) y la sucursal
 * debe existir y estar activa. El texto de cada respuesta se guarda como
 * snapshot para que el reporte histórico sobreviva ediciones de preguntas.
 */
export async function POST(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const body = await request.json();
        const { uuid, respuestas } = body;

        const project = await resolveSurveyUuid(typeof uuid === 'string' ? uuid : '');
        if (!project) {
            // Mismo mensaje para UUID mal formado, inexistente, revocado o
            // módulo apagado.
            return NextResponse.json({ success: false, message: 'Liga no válida' }, { status: 404 });
        }

        if (!Array.isArray(respuestas) || respuestas.length === 0 || respuestas.length > MAX_SURVEY_QUESTIONS) {
            return NextResponse.json({ success: false, message: 'Respuestas inválidas' }, { status: 400 });
        }

        connection = await getProjectConnection(project.idProyecto);

        const [questionRows] = await connection.query<RowDataPacket[]>(
            `SELECT IdPregunta, Pregunta, TipoPregunta, Etiquetas
             FROM tblEncuestasPreguntas WHERE Activa = 1`
        );
        if (questionRows.length === 0) {
            return NextResponse.json({ success: false, message: 'La encuesta no tiene preguntas activas' }, { status: 400 });
        }

        const activeQuestions = new Map<number, { pregunta: string; tipo: SurveyQuestionType; etiquetas: string[] }>();
        for (const q of questionRows) {
            const tipo: SurveyQuestionType = q.TipoPregunta === 'opciones' ? 'opciones' : 'estrellas';
            const etiquetas = parseQuestionLabels(q.Etiquetas);
            // Mismo filtro que /api/surveys/session: una pregunta de opciones
            // sin al menos 2 opciones no se muestra, así que no se exige.
            if (tipo === 'opciones' && etiquetas.filter(Boolean).length < 2) continue;
            activeQuestions.set(q.IdPregunta, { pregunta: q.Pregunta, tipo, etiquetas });
        }
        if (activeQuestions.size === 0) {
            return NextResponse.json({ success: false, message: 'La encuesta no tiene preguntas activas' }, { status: 400 });
        }

        // Cada respuesta debe apuntar a una pregunta activa, sin repetirse y
        // con el valor dentro del rango de esa pregunta.
        const answers = new Map<number, number>();
        for (const item of respuestas) {
            const idPregunta = Number(item?.idPregunta);
            const valor = Number(item?.valor);
            const question = activeQuestions.get(idPregunta);
            if (!question || answers.has(idPregunta)) {
                return NextResponse.json({ success: false, message: 'Respuestas inválidas' }, { status: 400 });
            }
            const max = maxValueForQuestion(question.tipo, question.etiquetas);
            if (!Number.isInteger(valor) || valor < 1 || valor > max) {
                return NextResponse.json({ success: false, message: 'Respuestas inválidas' }, { status: 400 });
            }
            answers.set(idPregunta, valor);
        }
        if (answers.size !== activeQuestions.size) {
            return NextResponse.json({ success: false, message: 'Faltan preguntas por contestar' }, { status: 400 });
        }

        const comentario = sanitizeSurveyComment(body.comentario);

        // Correo: opcional; si viene mal formado se rechaza para no guardar
        // basura en la lista de contactos del restaurante.
        const correoRaw = sanitizeSurveyText(body.correo, MAX_EMAIL_LEN);
        if (correoRaw && !isValidSurveyEmail(correoRaw)) {
            return NextResponse.json({ success: false, message: 'Correo inválido' }, { status: 400 });
        }
        const correo = correoRaw ? correoRaw.toLowerCase() : null;
        const aceptaPromos = correo && body.aceptaPromos ? 1 : 0;

        // Sucursal: viene del parámetro ?s= de la liga; si no existe o está
        // inactiva se guarda sin sucursal en lugar de rechazar la encuesta.
        let idSucursal: number | null = null;
        const idSucursalRaw = Number(body.idSucursal);
        if (Number.isInteger(idSucursalRaw) && idSucursalRaw > 0) {
            const [branchRows] = await connection.query<RowDataPacket[]>(
                'SELECT IdSucursal FROM tblSucursales WHERE IdSucursal = ? AND Status = 0',
                [idSucursalRaw]
            );
            if (branchRows.length > 0) idSucursal = idSucursalRaw;
        }

        await connection.beginTransaction();
        try {
            const [inserted] = await connection.query<ResultSetHeader>(
                `INSERT INTO tblEncuestasRespuestas
                    (IdSucursal, Correo, AceptaPromos, Comentario, Fecha, FechaAct)
                 VALUES (?, ?, ?, ?, Now(), Now())`,
                [idSucursal, correo, aceptaPromos, comentario]
            );
            const idRespuesta = inserted.insertId;

            for (const [idPregunta, valor] of answers) {
                const question = activeQuestions.get(idPregunta)!;
                await connection.query(
                    `INSERT INTO tblEncuestasRespuestasDetalle
                        (IdRespuesta, IdPregunta, Pregunta, TipoPregunta, Valor, Etiqueta)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        idRespuesta,
                        idPregunta,
                        question.pregunta,
                        question.tipo,
                        valor,
                        labelForValue(question.tipo, question.etiquetas, valor),
                    ]
                );
            }

            await connection.commit();
            return NextResponse.json({ success: true, idRespuesta });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error saving survey response:', error);
        return NextResponse.json({ success: false, message: 'Error al guardar la encuesta' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
