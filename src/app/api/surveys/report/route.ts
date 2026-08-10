import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';
import { SURVEY_SCALE } from '@/lib/surveys';

/** El reporte lista respuestas individuales acotadas para no reventar la página. */
const MAX_REPORT_RESPONSES = 500;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reporteador de encuestas (portal autenticado).
 *
 * Devuelve, para un rango de fechas y sucursal opcional:
 *  - resumen: total de respuestas, promedio general, comentarios y correos;
 *  - por pregunta: promedio y distribución 1..5 (agrupado por snapshot, así
 *    las preguntas editadas o borradas siguen apareciendo en su periodo);
 *  - respuestas individuales (las más recientes) con su detalle.
 */
export async function GET(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const startParam = searchParams.get('startDate') || '';
        const endParam = searchParams.get('endDate') || '';
        const branchParam = Number(searchParams.get('idSucursal'));

        // Default: últimos 30 días.
        const today = new Date();
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const toIso = (d: Date) => d.toISOString().slice(0, 10);
        const startDate = DATE_PATTERN.test(startParam) ? startParam : toIso(monthAgo);
        const endDate = DATE_PATTERN.test(endParam) ? endParam : toIso(today);

        const filters: string[] = ['r.Fecha >= ?', 'r.Fecha < DATE_ADD(?, INTERVAL 1 DAY)'];
        const params: (string | number)[] = [startDate, endDate];
        if (Number.isInteger(branchParam) && branchParam > 0) {
            filters.push('r.IdSucursal = ?');
            params.push(branchParam);
        }
        const where = filters.join(' AND ');

        connection = await getProjectConnection(parseInt(projectIdStr));

        const [summaryRows] = await connection.query<RowDataPacket[]>(
            `SELECT
                COUNT(*) AS TotalRespuestas,
                SUM(CASE WHEN r.Comentario IS NOT NULL AND r.Comentario <> '' THEN 1 ELSE 0 END) AS TotalComentarios,
                SUM(CASE WHEN r.Correo IS NOT NULL AND r.Correo <> '' THEN 1 ELSE 0 END) AS TotalCorreos,
                SUM(CASE WHEN r.AceptaPromos = 1 THEN 1 ELSE 0 END) AS TotalOptIn
             FROM tblEncuestasRespuestas r
             WHERE ${where}`,
            params
        );

        const [avgRows] = await connection.query<RowDataPacket[]>(
            `SELECT AVG(d.Valor) AS Promedio
             FROM tblEncuestasRespuestasDetalle d
             INNER JOIN tblEncuestasRespuestas r ON r.IdRespuesta = d.IdRespuesta
             WHERE ${where}`,
            params
        );

        // Por pregunta: el snapshot manda (sobrevive ediciones/borrados);
        // el orden sale de la configuración actual cuando la pregunta sigue viva.
        const [questionRows] = await connection.query<RowDataPacket[]>(
            `SELECT
                d.IdPregunta,
                MAX(d.Pregunta) AS Pregunta,
                MAX(d.TipoPregunta) AS TipoPregunta,
                COUNT(*) AS Total,
                AVG(d.Valor) AS Promedio,
                SUM(CASE WHEN d.Valor = 1 THEN 1 ELSE 0 END) AS V1,
                SUM(CASE WHEN d.Valor = 2 THEN 1 ELSE 0 END) AS V2,
                SUM(CASE WHEN d.Valor = 3 THEN 1 ELSE 0 END) AS V3,
                SUM(CASE WHEN d.Valor = 4 THEN 1 ELSE 0 END) AS V4,
                SUM(CASE WHEN d.Valor = 5 THEN 1 ELSE 0 END) AS V5
             FROM tblEncuestasRespuestasDetalle d
             INNER JOIN tblEncuestasRespuestas r ON r.IdRespuesta = d.IdRespuesta
             WHERE ${where}
             GROUP BY d.IdPregunta
             ORDER BY MIN(COALESCE((SELECT p.Orden FROM tblEncuestasPreguntas p WHERE p.IdPregunta = d.IdPregunta), 999)), d.IdPregunta`,
            params
        );

        // Etiquetas más elegidas por valor (para pintar '5 · Excelente' en
        // preguntas de opciones sin depender de la configuración actual).
        const [labelRows] = await connection.query<RowDataPacket[]>(
            `SELECT d.IdPregunta, d.Valor, d.Etiqueta, COUNT(*) AS Total
             FROM tblEncuestasRespuestasDetalle d
             INNER JOIN tblEncuestasRespuestas r ON r.IdRespuesta = d.IdRespuesta
             WHERE ${where} AND d.Etiqueta IS NOT NULL AND d.Etiqueta <> ''
             GROUP BY d.IdPregunta, d.Valor, d.Etiqueta`,
            params
        );
        const labelMap = new Map<string, { etiqueta: string; total: number }>();
        for (const row of labelRows) {
            const key = `${row.IdPregunta}:${row.Valor}`;
            const current = labelMap.get(key);
            if (!current || row.Total > current.total) {
                labelMap.set(key, { etiqueta: row.Etiqueta, total: row.Total });
            }
        }

        // Quién atendió: se agrupa por NOMBRE y no por IdAtendio para que la
        // misma persona no salga partida en dos cuando unas encuestas la
        // eligieron de la lista y otras la escribieron a mano.
        const [attendantRows] = await connection.query<RowDataPacket[]>(
            `SELECT
                r.Atendio AS Nombre,
                COUNT(DISTINCT r.IdRespuesta) AS Total,
                AVG(d.Valor) AS Promedio
             FROM tblEncuestasRespuestas r
             LEFT JOIN tblEncuestasRespuestasDetalle d ON d.IdRespuesta = r.IdRespuesta
             WHERE ${where} AND r.Atendio IS NOT NULL AND r.Atendio <> ''
             GROUP BY r.Atendio
             ORDER BY Total DESC, Nombre ASC`,
            params
        );

        const [responseRows] = await connection.query<RowDataPacket[]>(
            `SELECT
                r.IdRespuesta, r.IdSucursal, s.Sucursal, r.Correo, r.AceptaPromos,
                r.Comentario, r.Atendio, r.Fecha
             FROM tblEncuestasRespuestas r
             LEFT JOIN tblSucursales s ON s.IdSucursal = r.IdSucursal
             WHERE ${where}
             ORDER BY r.Fecha DESC, r.IdRespuesta DESC
             LIMIT ${MAX_REPORT_RESPONSES}`,
            params
        );

        // Detalle de las respuestas listadas, cosido en JS (sin JSON_ARRAYAGG
        // para no depender de la versión de MySQL de cada proyecto).
        let details: RowDataPacket[] = [];
        if (responseRows.length > 0) {
            const ids = responseRows.map(r => r.IdRespuesta);
            const [detailRows] = await connection.query<RowDataPacket[]>(
                `SELECT IdRespuesta, IdPregunta, Pregunta, TipoPregunta, Valor, Etiqueta
                 FROM tblEncuestasRespuestasDetalle
                 WHERE IdRespuesta IN (${ids.map(() => '?').join(',')})
                 ORDER BY IdDetalle ASC`,
                ids
            );
            details = detailRows;
        }
        const detailsByResponse = new Map<number, RowDataPacket[]>();
        for (const d of details) {
            const list = detailsByResponse.get(d.IdRespuesta) || [];
            list.push(d);
            detailsByResponse.set(d.IdRespuesta, list);
        }

        const [branches] = await connection.query<RowDataPacket[]>(
            'SELECT IdSucursal, Sucursal FROM tblSucursales WHERE Status = 0 ORDER BY Sucursal ASC'
        );

        const summary = summaryRows[0] ?? ({} as RowDataPacket);
        return NextResponse.json({
            success: true,
            range: { startDate, endDate },
            summary: {
                totalRespuestas: Number(summary.TotalRespuestas) || 0,
                promedioGeneral: avgRows[0]?.Promedio != null ? Number(avgRows[0].Promedio) : null,
                totalComentarios: Number(summary.TotalComentarios) || 0,
                totalCorreos: Number(summary.TotalCorreos) || 0,
                totalOptIn: Number(summary.TotalOptIn) || 0,
            },
            questions: questionRows.map(q => ({
                idPregunta: q.IdPregunta,
                pregunta: q.Pregunta,
                tipo: q.TipoPregunta === 'opciones' ? 'opciones' : 'estrellas',
                total: Number(q.Total) || 0,
                promedio: q.Promedio !== null ? Number(q.Promedio) : null,
                distribucion: Array.from({ length: SURVEY_SCALE }, (_, i) => ({
                    valor: i + 1,
                    total: Number(q[`V${i + 1}`]) || 0,
                    etiqueta: labelMap.get(`${q.IdPregunta}:${i + 1}`)?.etiqueta ?? null,
                })),
            })),
            attendants: attendantRows.map(a => ({
                nombre: a.Nombre,
                total: Number(a.Total) || 0,
                promedio: a.Promedio !== null ? Number(a.Promedio) : null,
            })),
            responses: responseRows.map(r => ({
                idRespuesta: r.IdRespuesta,
                fecha: r.Fecha,
                sucursal: r.Sucursal || null,
                correo: r.Correo || null,
                aceptaPromos: r.AceptaPromos === 1,
                comentario: r.Comentario || null,
                atendio: r.Atendio || null,
                detalle: (detailsByResponse.get(r.IdRespuesta) || []).map(d => ({
                    pregunta: d.Pregunta,
                    tipo: d.TipoPregunta === 'opciones' ? 'opciones' : 'estrellas',
                    valor: d.Valor,
                    etiqueta: d.Etiqueta || null,
                })),
            })),
            branches,
            truncated: responseRows.length === MAX_REPORT_RESPONSES,
        });
    } catch (error) {
        console.error('Error building survey report:', error);
        return NextResponse.json({ success: false, message: 'Error al generar el reporte' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
