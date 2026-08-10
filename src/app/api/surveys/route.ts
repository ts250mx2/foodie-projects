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
    isValidSurveyPhone,
    parseAttendantMode,
    attendantModeAllowsList,
    attendantModeAllowsText,
    MAX_SURVEY_QUESTIONS,
    MAX_EMAIL_LEN,
    MAX_PHONE_LEN,
    MAX_ATTENDANT_NAME_LEN,
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

        // Configuración vigente: manda sobre lo que exige el servidor (nunca
        // el cliente). Sin renglón de config aplican los defaults.
        const [configRows] = await connection.query<RowDataPacket[]>(
            `SELECT RegaloActivo, AtencionActiva, AtencionModo, AtencionObligatoria
             FROM tblEncuestasConfig ORDER BY IdConfig ASC LIMIT 1`
        );
        const cfg = configRows[0];
        const regaloActivo = cfg?.RegaloActivo === 0 ? 0 : 1;

        // Contacto: con regalo activo se exige teléfono O correo (al menos
        // uno); con el regalo apagado la encuesta sigue siendo anónima. Si
        // algo viene mal formado se rechaza para no guardar basura en la
        // lista de contactos del restaurante.
        const correoRaw = sanitizeSurveyText(body.correo, MAX_EMAIL_LEN);
        if (correoRaw && !isValidSurveyEmail(correoRaw)) {
            return NextResponse.json({ success: false, message: 'Correo inválido' }, { status: 400 });
        }
        const correo = correoRaw ? correoRaw.toLowerCase() : null;

        const telefono = sanitizeSurveyText(body.telefono, MAX_PHONE_LEN);
        if (telefono && !isValidSurveyPhone(telefono)) {
            return NextResponse.json({ success: false, message: 'Teléfono inválido' }, { status: 400 });
        }

        if (regaloActivo === 1 && !correo && !telefono) {
            return NextResponse.json(
                { success: false, message: 'Comparte tu teléfono o tu correo para enviar la encuesta' },
                { status: 400 }
            );
        }

        const aceptaPromos = (correo || telefono) && body.aceptaPromos ? 1 : 0;

        // ── ¿Quién te atendió? ───────────────────────────────────────────
        // El modo lo manda la configuración, nunca el cliente: una tablet
        // desactualizada no puede colar texto libre donde solo hay lista.
        const atencionModo = parseAttendantMode(cfg?.AtencionModo);

        // Modo 'lista' sin nadie activo en la lista = bloque incontestable.
        // /api/surveys/session lo apaga en la tablet; aquí se apaga igual, o
        // una lista vacía marcada como obligatoria trabaría TODOS los envíos.
        let atencionActiva = cfg?.AtencionActiva === 1;
        if (atencionActiva && atencionModo === 'lista') {
            const [activos] = await connection.query<RowDataPacket[]>(
                'SELECT 1 FROM tblEncuestasAtendieron WHERE Activo = 1 LIMIT 1'
            );
            if (activos.length === 0) atencionActiva = false;
        }

        let idAtendio: number | null = null;
        let atendio: string | null = null;

        if (atencionActiva) {
            const idAtendioRaw = Number(body.idAtendio);
            if (attendantModeAllowsList(atencionModo) && Number.isInteger(idAtendioRaw) && idAtendioRaw > 0) {
                const [personRows] = await connection.query<RowDataPacket[]>(
                    'SELECT IdAtendio, Nombre FROM tblEncuestasAtendieron WHERE IdAtendio = ? AND Activo = 1',
                    [idAtendioRaw]
                );
                if (personRows.length === 0) {
                    return NextResponse.json({ success: false, message: 'Esa persona ya no está disponible' }, { status: 400 });
                }
                idAtendio = personRows[0].IdAtendio;
                // Snapshot del nombre: el reporte no se rompe si luego se borra.
                atendio = personRows[0].Nombre;
            } else if (attendantModeAllowsText(atencionModo)) {
                atendio = sanitizeSurveyText(body.atendio, MAX_ATTENDANT_NAME_LEN);
            }

            if (cfg?.AtencionObligatoria === 1 && !atendio) {
                return NextResponse.json(
                    { success: false, message: 'Falta indicar quién te atendió' },
                    { status: 400 }
                );
            }
        }

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
                    (IdSucursal, Correo, Telefono, AceptaPromos, Comentario, IdAtendio, Atendio, Fecha, FechaAct)
                 VALUES (?, ?, ?, ?, ?, ?, ?, Now(), Now())`,
                [idSucursal, correo, telefono, aceptaPromos, comentario, idAtendio, atendio]
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
