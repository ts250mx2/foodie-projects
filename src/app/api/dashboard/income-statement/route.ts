import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export const runtime = 'nodejs';

/**
 * POST /api/dashboard/income-statement
 * Calcula el Estado de Resultados para un período:
 * - VENTAS: suma de ventas por canal (tblVentasCanalesVenta)
 * - COSTO DE MATERIA PRIMA: suma de compras (tblCompras)
 * - GASTOS OPERATIVOS: suma de gastos (tblGastos)
 * - NÓMINA: suma de nómina (tblNomina)
 * - UTILIDAD: VENTAS - (COSTO + GASTOS + NÓMINA)
 */
export async function POST(request: NextRequest) {
    let connection;
    try {
        const { projectId, branchId, month, year } = await request.json();

        if (!projectId || branchId === undefined || month === undefined || year === undefined) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        connection = await getProjectConnection(parseInt(projectId));

        // Fecha de inicio y fin del mes
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // 1. VENTAS por canal (tblVentasCanalesVenta con nombres de canal desde tblCanalesVenta)
        // tblVentasCanalesVenta usa Mes=0-11, Anio, Dia
        const [ventasRows] = await connection.query(
            `SELECT
                COALESCE(c.CanalVenta, 'OTROS') AS canal,
                SUM(v.Venta) AS monto
             FROM tblVentasCanalesVenta v
             LEFT JOIN tblCanalesVenta c ON v.IdCanalVenta = c.IdCanalVenta
             WHERE v.IdSucursal = ? AND v.Mes = ? AND v.Anio = ?
             GROUP BY COALESCE(c.CanalVenta, 'OTROS')
             ORDER BY monto DESC`,
            [parseInt(branchId), month, year]
        );

        const totalVentas = (ventasRows as RowDataPacket[]).reduce((sum, row) => sum + Number(row.monto || 0), 0);

        // 2. COSTO DE MATERIA PRIMA. El TOTAL sale de la cabecera de tblCompras con
        // exactamente el mismo filtro que el KPI del dashboard (/api/dashboard/kpi/sales:
        // SUM(Total), MONTH/YEAR y Status != 2) para que ambas cifras cuadren siempre.
        const [comprasTotalRows] = await connection.query(
            `SELECT SUM(Total) AS total
             FROM tblCompras
             WHERE IdSucursal = ? AND MONTH(FechaCompra) = ? AND YEAR(FechaCompra) = ? AND Status != 2`,
            [parseInt(branchId), month + 1, year]
        );
        const costMateriaPrima = Number((comprasTotalRows as RowDataPacket[])[0]?.total || 0);

        // Desglose por categoría desde los renglones de detalle. Puede sumar menos que
        // la cabecera (compras capturadas sin desglose de productos); la diferencia se
        // muestra como "SIN DESGLOSE" para que las líneas cuadren con el total.
        const [comprasDetalleRows] = await connection.query(
            `SELECT
                COALESCE(c.Categoria, 'SIN CATEGORÍA') AS categoria,
                SUM(d.Cantidad * d.Costo) AS total
             FROM tblCompras co
             JOIN tblDetalleCompras d ON co.IdCompra = d.IdCompra
             JOIN tblProductos p ON d.IdProducto = p.IdProducto
             LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
             WHERE co.IdSucursal = ? AND MONTH(co.FechaCompra) = ? AND YEAR(co.FechaCompra) = ? AND co.Status != 2
             GROUP BY COALESCE(c.Categoria, 'SIN CATEGORÍA')
             ORDER BY total DESC`,
            [parseInt(branchId), month + 1, year]
        );

        const comprasRows = [...(comprasDetalleRows as RowDataPacket[])];
        const sumaDetalle = comprasRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
        const sinDesglose = costMateriaPrima - sumaDetalle;
        if (Math.abs(sinDesglose) >= 0.01) {
            comprasRows.push({ categoria: 'SIN DESGLOSE', total: sinDesglose } as RowDataPacket);
        }

        // 3. GASTOS OPERATIVOS (de tblGastos) — usa Dia/Mes(1-12)/Anio.
        // El concepto puede ser texto libre (IdConceptoGasto = 0) o venir del
        // catálogo tblConceptosGastos; mismo patrón que /api/expenses/daily.
        const [gastosRows] = await connection.query(
            `SELECT
                COALESCE(
                    NULLIF(CASE WHEN g.IdConceptoGasto = 0 THEN g.ConceptoGasto ELSE c.ConceptoGasto END, ''),
                    'SIN CONCEPTO'
                ) AS ConceptoGasto,
                SUM(g.Total) AS total
             FROM tblGastos g
             LEFT JOIN tblConceptosGastos c ON g.IdConceptoGasto = c.IdConceptoGasto
             WHERE g.IdSucursal = ? AND g.Mes = ? AND g.Anio = ?
             GROUP BY 1
             ORDER BY total DESC`,
            [parseInt(branchId), month + 1, year]
        );

        const totalGastos = (gastosRows as RowDataPacket[]).reduce((sum, row) => sum + Number(row.total || 0), 0);

        // 4. NÓMINA (de tblNomina) — usa Dia/Mes(1-12)/Anio
        const [nominaRows] = await connection.query(
            `SELECT
                SUM(Pago) AS total
             FROM tblNomina
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [parseInt(branchId), month + 1, year]
        );

        const totalNomina = Number((nominaRows as RowDataPacket[])[0]?.total || 0);

        // Cálculos finales
        const costoTotal = costMateriaPrima + totalGastos + totalNomina;
        const utilidad = totalVentas - costoTotal;
        const margenUtilidad = totalVentas > 0 ? (utilidad / totalVentas) * 100 : 0;

        return NextResponse.json({
            success: true,
            period: { month, year, startDate: startDateStr, endDate: endDateStr },
            ventas: {
                detalles: ventasRows,
                total: totalVentas,
                porcentaje: 100,
            },
            costoMateriaPrima: {
                detalles: comprasRows,
                total: costMateriaPrima,
                porcentaje: totalVentas > 0 ? (costMateriaPrima / totalVentas) * 100 : 0,
            },
            gastosOperativos: {
                detalles: gastosRows,
                total: totalGastos,
                porcentaje: totalVentas > 0 ? (totalGastos / totalVentas) * 100 : 0,
            },
            nomina: {
                total: totalNomina,
                porcentaje: totalVentas > 0 ? (totalNomina / totalVentas) * 100 : 0,
            },
            costoTotal,
            utilidad,
            margenUtilidad,
        });
    } catch (error) {
        console.error('Error calculating income statement:', error);
        return NextResponse.json(
            { success: false, error: 'Error calculating income statement' },
            { status: 500 }
        );
    } finally {
        if (connection) await connection.end();
    }
}
