import { NextRequest, NextResponse } from 'next/server';
import {
    TEMPLATE_DB,
    diffAllProjectDatabases,
    syncAllProjectDatabases,
} from '@/lib/db-template';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/db-sync — dry-run: reporta qué le falta a cada BD FG_*
 * respecto a la plantilla (FG_Frijoles), sin aplicar ningún cambio.
 */
export async function GET() {
    try {
        const diffs = await diffAllProjectDatabases();
        const pending = diffs.filter(d =>
            d.missingTables.length > 0 ||
            Object.keys(d.missingColumns).length > 0 ||
            d.missingViews.length > 0
        );

        return NextResponse.json({
            success: true,
            template: TEMPLATE_DB,
            databases: diffs.length,
            databasesWithPendingChanges: pending.length,
            diffs,
        });
    } catch (error) {
        console.error('[db-sync] Error en dry-run:', error);
        return NextResponse.json(
            { success: false, message: 'Error calculando diferencias con la plantilla' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/db-sync — aplica la sincronización a todas las BDs FG_*:
 * crea tablas/columnas/vistas faltantes. Con { "replaceViews": true } (default)
 * además rehace TODAS las vistas para propagar cambios de definición.
 * Solo aditivo: nunca elimina ni modifica tablas o columnas existentes.
 */
export async function POST(request: NextRequest) {
    try {
        let replaceViews = true;
        try {
            const body = await request.json();
            if (typeof body?.replaceViews === 'boolean') replaceViews = body.replaceViews;
        } catch { /* body vacío: usar defaults */ }

        const reports = await syncAllProjectDatabases({ replaceViews });
        const totals = reports.reduce(
            (acc, r) => ({
                tablesCreated: acc.tablesCreated + r.tablesCreated.length,
                columnsAdded: acc.columnsAdded + r.columnsAdded.length,
                viewsCreated: acc.viewsCreated + r.viewsCreated.length,
                errors: acc.errors + r.errors.length,
            }),
            { tablesCreated: 0, columnsAdded: 0, viewsCreated: 0, errors: 0 }
        );

        return NextResponse.json({
            success: totals.errors === 0,
            template: TEMPLATE_DB,
            totals,
            reports,
        });
    } catch (error) {
        console.error('[db-sync] Error aplicando sincronización:', error);
        return NextResponse.json(
            { success: false, message: 'Error sincronizando las bases de datos' },
            { status: 500 }
        );
    }
}
