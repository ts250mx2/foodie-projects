import { NextRequest, NextResponse } from 'next/server';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';
import { sanitizeSurveyText, DEFAULT_SURVEY_CONFIG, MAX_CONFIG_TEXT_LEN, SURVEY_SCALE } from '@/lib/surveys';

/**
 * Textos y comportamiento de la encuesta (portal autenticado).
 * La lectura vive en GET /api/surveys/questions (una sola llamada para la
 * página de configuración); aquí solo se guarda.
 */
export async function PUT(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const body = await request.json();
        const { projectId, config } = body;
        if (!projectId || !config || typeof config !== 'object') {
            return NextResponse.json({ success: false, message: 'Parámetros inválidos' }, { status: 400 });
        }

        const d = DEFAULT_SURVEY_CONFIG;
        const text = (value: unknown, fallback: string) =>
            sanitizeSurveyText(value, MAX_CONFIG_TEXT_LEN) ?? fallback;

        // El título es obligatorio; los demás textos aceptan vaciarse (la
        // página pública oculta la línea correspondiente).
        const titulo = sanitizeSurveyText(config.Titulo, MAX_CONFIG_TEXT_LEN) || d.Titulo;
        const optionalText = (value: unknown) => sanitizeSurveyText(value, MAX_CONFIG_TEXT_LEN);

        const umbralRaw = Number(config.UmbralComentario);
        // Umbral 0 = nunca pedir comentario; tope 5 = pedirlo siempre.
        const umbral = Number.isInteger(umbralRaw) && umbralRaw >= 0 && umbralRaw <= SURVEY_SCALE
            ? umbralRaw
            : d.UmbralComentario;

        connection = await getProjectConnection(parseInt(projectId));

        const [rows] = await connection.query<RowDataPacket[]>(
            'SELECT IdConfig FROM tblEncuestasConfig ORDER BY IdConfig ASC LIMIT 1'
        );
        let idConfig = rows[0]?.IdConfig;
        if (!idConfig) {
            // Se siembra al conectar por primera vez (dynamic-db), pero si el
            // renglón falta se crea aquí en vez de rechazar el guardado. Misma
            // PK fija que la siembra (IdConfig = 1) para que no haya carrera.
            await connection.query<ResultSetHeader>(
                'INSERT IGNORE INTO tblEncuestasConfig (IdConfig, Titulo, FechaAct) VALUES (1, ?, Now())',
                [d.Titulo]
            );
            idConfig = 1;
        }

        await connection.query(
            `UPDATE tblEncuestasConfig SET
                Titulo = ?, Subtitulo = ?, Subtitulo2 = ?, UmbralComentario = ?,
                TituloComentario = ?, TextoComentario = ?, RegaloActivo = ?,
                TituloRegalo = ?, TextoRegalo = ?, TextoPromos = ?, TextoBotonEnviar = ?,
                TituloGracias = ?, TextoGracias = ?, FechaAct = Now()
             WHERE IdConfig = ?`,
            [
                titulo,
                optionalText(config.Subtitulo),
                optionalText(config.Subtitulo2),
                umbral,
                text(config.TituloComentario, d.TituloComentario),
                optionalText(config.TextoComentario),
                config.RegaloActivo === 0 || config.RegaloActivo === false ? 0 : 1,
                text(config.TituloRegalo, d.TituloRegalo),
                optionalText(config.TextoRegalo),
                text(config.TextoPromos, d.TextoPromos),
                text(config.TextoBotonEnviar, d.TextoBotonEnviar),
                text(config.TituloGracias, d.TituloGracias),
                optionalText(config.TextoGracias),
                idConfig,
            ]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving survey config:', error);
        return NextResponse.json({ success: false, message: 'Error al guardar la configuración' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
