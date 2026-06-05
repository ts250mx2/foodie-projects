import { NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { getReport, resolveReportSql } from '@/lib/ai/reports-store';

interface Params { params: Promise<{ id: string }> }

// GET /api/reports/[id]/data?projectId=&month=&year=  → definición + filas
// Re-ejecuta el SQL guardado, sustituyendo los tokens de parámetros (mes/año) por los
// valores recibidos (o sus defaults). Read-only, con LIMIT defensivo.
export async function GET(req: Request, { params }: Params) {
    let conn: any = null;
    try {
        const { id } = await params;
        const sp = new URL(req.url).searchParams;
        const projectId = Number(sp.get('projectId'));
        const reportId = Number(id);
        if (!projectId || !reportId) return NextResponse.json({ error: 'projectId e id requeridos' }, { status: 400 });

        conn = await getProjectConnection(projectId);
        const report = await getReport(conn, reportId);
        if (!report) return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });

        // Valores de parámetros enviados por el visor (todo lo que no sea projectId).
        const values: Record<string, string> = {};
        sp.forEach((val, key) => { if (key !== 'projectId') values[key] = val; });

        // Resuelve los tokens {{...}} de forma segura (solo enteros saneados).
        const sql = resolveReportSql(report.definition, values);
        const lower = sql.toLowerCase().trim();
        if (!lower.startsWith('select') && !lower.startsWith('with')) {
            return NextResponse.json({ error: 'El reporte tiene un SQL no permitido' }, { status: 400 });
        }
        const limited = /\blimit\b/i.test(sql) ? sql : `${sql.replace(/;\s*$/, '')} LIMIT 1000`;
        const [rows] = await conn.execute(limited);

        return NextResponse.json({ definition: report.definition, rows, modelo: report.modelo, fechaCreacion: report.fechaCreacion });
    } catch (e: any) {
        console.error('reports/[id]/data error:', e);
        return NextResponse.json({ error: e?.message || 'Error ejecutando el reporte' }, { status: 500 });
    } finally {
        if (conn) { try { await conn.end(); } catch { /* noop */ } }
    }
}
