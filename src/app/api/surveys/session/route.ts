import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';
import { resolveSurveyUuid, parseQuestionLabels, DEFAULT_SURVEY_CONFIG } from '@/lib/surveys';

/**
 * Arranque de la página pública de la encuesta (tablet en piso).
 *
 * ENDPOINT SIN AUTENTICACIÓN: la única credencial es el UUID de la URL.
 * Devuelve el mínimo indispensable: tema visual, textos configurados y
 * preguntas activas. Nada de respuestas de otros comensales ni correos.
 */
export async function GET(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const uuid = searchParams.get('uuid') || '';

        const project = await resolveSurveyUuid(uuid);
        if (!project) {
            // Mismo mensaje para UUID mal formado, inexistente, revocado o
            // módulo apagado: no le decimos a un curioso en cuál caso cayó.
            return NextResponse.json({ success: false, message: 'Liga no válida' }, { status: 404 });
        }

        connection = await getProjectConnection(project.idProyecto);

        const [configRows] = await connection.query<RowDataPacket[]>(
            'SELECT * FROM tblEncuestasConfig ORDER BY IdConfig ASC LIMIT 1'
        );
        const cfg = configRows[0] ?? ({} as RowDataPacket);
        const d = DEFAULT_SURVEY_CONFIG;

        const [questionRows] = await connection.query<RowDataPacket[]>(
            `SELECT IdPregunta, Pregunta, TipoPregunta, Etiquetas, Orden
             FROM tblEncuestasPreguntas
             WHERE Activa = 1
             ORDER BY Orden ASC, IdPregunta ASC`
        );

        // Sucursales activas: la liga puede venir con ?s=IdSucursal para
        // etiquetar de qué sucursal es la tablet. Solo id y nombre.
        const [branches] = await connection.query<RowDataPacket[]>(
            'SELECT IdSucursal, Sucursal FROM tblSucursales WHERE Status = 0 ORDER BY Sucursal ASC'
        );

        return NextResponse.json({
            success: true,
            project: {
                titulo: project.titulo || project.proyecto,
                logo64: project.logo64,
                colorFondo1: project.colorFondo1,
                colorFondo2: project.colorFondo2,
                colorLetra: project.colorLetra,
            },
            config: {
                titulo: cfg.Titulo || d.Titulo,
                subtitulo: cfg.Subtitulo ?? d.Subtitulo,
                subtitulo2: cfg.Subtitulo2 ?? d.Subtitulo2,
                umbralComentario: Number.isInteger(cfg.UmbralComentario) ? cfg.UmbralComentario : d.UmbralComentario,
                tituloComentario: cfg.TituloComentario ?? d.TituloComentario,
                textoComentario: cfg.TextoComentario ?? d.TextoComentario,
                regaloActivo: cfg.RegaloActivo === 0 ? 0 : 1,
                tituloRegalo: cfg.TituloRegalo ?? d.TituloRegalo,
                textoRegalo: cfg.TextoRegalo ?? d.TextoRegalo,
                textoPromos: cfg.TextoPromos ?? d.TextoPromos,
                textoBotonEnviar: cfg.TextoBotonEnviar ?? d.TextoBotonEnviar,
                tituloGracias: cfg.TituloGracias ?? d.TituloGracias,
                textoGracias: cfg.TextoGracias ?? d.TextoGracias,
            },
            questions: questionRows
                .map(q => ({
                    idPregunta: q.IdPregunta,
                    pregunta: q.Pregunta,
                    tipo: q.TipoPregunta === 'opciones' ? 'opciones' : 'estrellas',
                    etiquetas: parseQuestionLabels(q.Etiquetas),
                }))
                // Una pregunta de opciones con menos de 2 opciones (JSON dañado)
                // no se puede contestar: mejor fuera que trabar la encuesta.
                // El submit aplica el MISMO filtro para que las cuentas cuadren.
                .filter(q => q.tipo !== 'opciones' || q.etiquetas.filter(Boolean).length >= 2),
            branches,
        });
    } catch (error) {
        console.error('Error loading survey session:', error);
        return NextResponse.json({ success: false, message: 'Error al cargar la encuesta' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
