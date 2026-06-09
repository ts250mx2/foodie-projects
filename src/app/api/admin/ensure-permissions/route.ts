import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getProjectConnection, ensureAccessAndPermissions } from '@/lib/dynamic-db';

/**
 * POST /api/admin/ensure-permissions
 * Recorre TODOS los proyectos (BDFoodieProjects.tblProyectos) y asegura en cada BD de
 * proyecto el esquema de acceso/permisos (columnas Login/Passwd/EsAdministrador en
 * tblEmpleados + tabla tblEmpleadosPermisos). Idempotente. Devuelve un reporte por proyecto.
 */
export async function POST() {
    try {
        const [projects]: any = await pool.query('SELECT IdProyecto, Proyecto FROM tblProyectos ORDER BY IdProyecto');
        const results: { idProyecto: number; proyecto: string; ok: boolean; error?: string }[] = [];

        for (const p of projects) {
            const id = p.IdProyecto;
            let conn: any = null;
            try {
                conn = await getProjectConnection(id);
                await ensureAccessAndPermissions(conn);
                results.push({ idProyecto: id, proyecto: p.Proyecto, ok: true });
            } catch (e: any) {
                results.push({ idProyecto: id, proyecto: p.Proyecto, ok: false, error: e?.message || 'Error' });
            } finally {
                if (conn) { try { await conn.end(); } catch { /* noop */ } }
            }
        }

        const ok = results.filter(r => r.ok).length;
        return NextResponse.json({ success: true, total: results.length, ok, failed: results.length - ok, results });
    } catch (e: any) {
        console.error('ensure-permissions migration error:', e);
        return NextResponse.json({ success: false, message: e?.message || 'Error' }, { status: 500 });
    }
}
