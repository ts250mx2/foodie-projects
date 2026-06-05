import { NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { listReports, deleteReport, moveReport } from '@/lib/ai/reports-store';

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

// PATCH /api/reports  { projectId, id, idCarpeta }  → mueve un reporte a una carpeta (o null)
export async function PATCH(req: Request) {
    let conn: any = null;
    try {
        const { projectId, id, idCarpeta } = await req.json();
        if (!projectId || !id) return NextResponse.json({ error: 'projectId e id requeridos' }, { status: 400 });
        const target = idCarpeta === null || idCarpeta === undefined || idCarpeta === '' ? null : Number(idCarpeta);
        conn = await getProjectConnection(projectId);
        await moveReport(conn, Number(id), target);
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
