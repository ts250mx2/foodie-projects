import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

/**
 * GET /api/config/break-even/expense-concepts?projectId&branchId&month&year
 *   month/year = MES SELECCIONADO en el análisis (month es 1-12).
 *
 * Devuelve TODOS los conceptos de gasto del proyecto y, para cada uno, el monto
 * gastado en el MES ANTERIOR INMEDIATO en esa sucursal (sugerencia de gasto fijo).
 * Convención de gastos: tblGastos.Mes es 1-12 y Status=2 = cancelado.
 */
export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = parseInt(searchParams.get('projectId') || '');
        const branchId = searchParams.get('branchId');
        const month = parseInt(searchParams.get('month') || '');   // mes seleccionado, 1-12
        const year = parseInt(searchParams.get('year') || '');

        if (!projectId || !branchId || !month || !year) {
            return NextResponse.json({ success: false, message: 'Missing parameters', concepts: [] }, { status: 400 });
        }

        // Mes anterior inmediato (1-12)
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth < 1) { prevMonth = 12; prevYear = year - 1; }

        connection = await getProjectConnection(projectId);

        // Catálogo de conceptos + gasto del mes anterior (LEFT JOIN → conceptos sin gasto salen en 0).
        const [rows] = await connection.query(
            `SELECT cg.ConceptoGasto                         AS concepto,
                    COALESCE(SUM(g.Total), 0)                AS monto,
                    COUNT(g.IdGasto)                         AS movimientos
             FROM tblConceptosGastos cg
             LEFT JOIN tblGastos g
                    ON g.IdConceptoGasto = cg.IdConceptoGasto
                   AND g.Mes = ? AND g.Anio = ? AND g.IdSucursal = ? AND g.Status <> 2
             WHERE (cg.Status IS NULL OR cg.Status <> 2)
               AND cg.ConceptoGasto IS NOT NULL AND TRIM(cg.ConceptoGasto) <> ''
             GROUP BY cg.IdConceptoGasto, cg.ConceptoGasto
             ORDER BY monto DESC, cg.ConceptoGasto ASC`,
            [prevMonth, prevYear, branchId]
        );

        const concepts = (rows as RowDataPacket[]).map(r => ({
            concepto: String(r.concepto),
            monto: Number(r.monto) || 0,
            movimientos: Number(r.movimientos) || 0,
        }));

        return NextResponse.json({ success: true, prevMonth, prevYear, concepts });
    } catch (error) {
        console.error('Error fetching expense concepts:', error);
        return NextResponse.json({ success: false, message: 'Error fetching expense concepts', concepts: [] }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
