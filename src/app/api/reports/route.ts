import { NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { listReports, deleteReport, moveReport, updateReport } from '@/lib/ai/reports-store';

// GET /api/reports?projectId=  → lista de reportes del proyecto
export async function GET(req: Request) {
    let conn: any = null;
    try {
        const projectId = Number(new URL(req.url).searchParams.get('projectId'));
        if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });
        conn = await getProjectConnection(projectId);
        const reports = await listReports(conn);
        return NextResponse.json({ reports });
    } catch (e: any) {
        console.error('reports GET error:', e);
        return NextResponse.json({ error: e?.message || 'Error', reports: [] }, { status: 500 });
    } finally {
        if (conn) { try { await conn.end(); } catch { /* noop */ } }
    }
}

// PATCH /api/reports  { projectId, id, idCarpeta?, titulo?, descripcion?, visualization? }
// Mueve un reporte a una carpeta (idCarpeta, null = sin carpeta) y/o edita sus metadatos.
export async function PATCH(req: Request) {
    let conn: any = null;
    try {
        const body = await req.json();
        const { projectId, id, idCarpeta, titulo, descripcion, visualization } = body;
        if (!projectId || !id) return NextResponse.json({ error: 'projectId e id requeridos' }, { status: 400 });
        conn = await getProjectConnection(projectId);

        if (titulo !== undefined || descripcion !== undefined || visualization !== undefined) {
            await updateReport(conn, Number(id), { titulo, descripcion, visualization });
        }
        if (idCarpeta !== undefined) {
            const target = idCarpeta === null || idCarpeta === '' ? null : Number(idCarpeta);
            await moveReport(conn, Number(id), target);
        }
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('reports PATCH error:', e);
        return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
    } finally {
        if (conn) { try { await conn.end(); } catch { /* noop */ } }
    }
}

// DELETE /api/reports?projectId=&id=  → soft-delete
export async function DELETE(req: Request) {
    let conn: any = null;
    try {
        const sp = new URL(req.url).searchParams;
        const projectId = Number(sp.get('projectId'));
        const id = Number(sp.get('id'));
        if (!projectId || !id) return NextResponse.json({ error: 'projectId e id requeridos' }, { status: 400 });
        conn = await getProjectConnection(projectId);
        await deleteReport(conn, id);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('reports DELETE error:', e);
        return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
    } finally {
        if (conn) { try { await conn.end(); } catch { /* noop */ } }
    }
}
