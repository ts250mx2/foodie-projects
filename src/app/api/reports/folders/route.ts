import { NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { listFolders, createFolder, renameFolder, deleteFolder } from '@/lib/ai/reports-store';

// GET /api/reports/folders?projectId=  → lista de carpetas (con conteo de reportes)
export async function GET(req: Request) {
    let conn: any = null;
    try {
        const projectId = Number(new URL(req.url).searchParams.get('projectId'));
        if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });
        conn = await getProjectConnection(projectId);
        const folders = await listFolders(conn);
        return NextResponse.json({ folders });
    } catch (e: any) {
        console.error('folders GET error:', e);
        return NextResponse.json({ error: e?.message || 'Error', folders: [] }, { status: 500 });
    } finally {
        if (conn) { try { await conn.end(); } catch { /* noop */ } }
    }
}

// POST /api/reports/folders  { projectId, nombre }  → crea carpeta
export async function POST(req: Request) {
    let conn: any = null;
    try {
        const { projectId, nombre } = await req.json();
        if (!projectId) return NextResponse.json({ error: 'projectId requerido' }, { status: 400 });
        if (!nombre || !String(nombre).trim()) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });
        conn = await getProjectConnection(projectId);
        const idCarpeta = await createFolder(conn, String(nombre));
        return NextResponse.json({ idCarpeta });
    } catch (e: any) {
        console.error('folders POST error:', e);
        return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
    } finally {
        if (conn) { try { await conn.end(); } catch { /* noop */ } }
    }
}

// PATCH /api/reports/folders  { projectId, id, nombre }  → renombra carpeta
export async function PATCH(req: Request) {
    let conn: any = null;
    try {
        const { projectId, id, nombre } = await req.json();
        if (!projectId || !id) return NextResponse.json({ error: 'projectId e id requeridos' }, { status: 400 });
        if (!nombre || !String(nombre).trim()) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });
        conn = await getProjectConnection(projectId);
        await renameFolder(conn, Number(id), String(nombre));
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('folders PATCH error:', e);
        return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
    } finally {
        if (conn) { try { await conn.end(); } catch { /* noop */ } }
    }
}

// DELETE /api/reports/folders?projectId=&id=  → borra carpeta (reportes pasan a "Sin carpeta")
export async function DELETE(req: Request) {
    let conn: any = null;
    try {
        const sp = new URL(req.url).searchParams;
        const projectId = Number(sp.get('projectId'));
        const id = Number(sp.get('id'));
        if (!projectId || !id) return NextResponse.json({ error: 'projectId e id requeridos' }, { status: 400 });
        conn = await getProjectConnection(projectId);
        await deleteFolder(conn, id);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('folders DELETE error:', e);
        return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
    } finally {
        if (conn) { try { await conn.end(); } catch { /* noop */ } }
    }
}
