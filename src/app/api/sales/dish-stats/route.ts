import { NextRequest, NextResponse } from 'next/server';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { Connection } from 'mysql2/promise';
import * as XLSX from 'xlsx';
import { getProjectConnection } from '@/lib/dynamic-db';
import { DishCandidate, extractSalesDishReport, suggestDish } from '@/lib/sales-dish-stats';

function validId(value: unknown) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
}

async function restoreLatestStoredReport(connection: Connection) {
    const [importsResult] = await connection.query(`
        SELECT i.IdImportacion
        FROM tblVentasImportaciones i
        JOIN tblVentasImportacionHojas resumen
          ON resumen.IdImportacion = i.IdImportacion AND resumen.NombreHoja = 'Resumen'
        JOIN tblVentasImportacionHojas ventas
          ON ventas.IdImportacion = i.IdImportacion AND ventas.NombreHoja = 'Resumen de Ventas'
        LEFT JOIN tblVentasPlatillosReportes reporte ON reporte.IdImportacion = i.IdImportacion
        WHERE reporte.IdReporte IS NULL
        ORDER BY i.FechaImportacion DESC, i.IdImportacion DESC
        LIMIT 1
    `);
    const storedImport = (importsResult as RowDataPacket[])[0];
    if (!storedImport) return false;

    const [storedRowsResult] = await connection.query(`
        SELECT h.NombreHoja, f.NumeroFila, f.Datos
        FROM tblVentasImportacionHojas h
        JOIN tblVentasImportacionFilas f ON f.IdHoja = h.IdHoja
        WHERE h.IdImportacion = ? AND h.NombreHoja IN ('Resumen', 'Resumen de Ventas')
        ORDER BY h.OrdenHoja, f.NumeroFila
    `, [storedImport.IdImportacion]);
    const rowsBySheet = new Map<string, unknown[][]>();
    for (const storedRow of storedRowsResult as RowDataPacket[]) {
        const sheetRows = rowsBySheet.get(storedRow.NombreHoja) ?? [];
        const values = typeof storedRow.Datos === 'string' ? JSON.parse(storedRow.Datos) : storedRow.Datos;
        sheetRows[Number(storedRow.NumeroFila) - 1] = Array.isArray(values) ? values : [];
        rowsBySheet.set(storedRow.NombreHoja, sheetRows);
    }

    const workbook = XLSX.utils.book_new();
    for (const sheetName of ['Resumen', 'Resumen de Ventas']) {
        const rows = rowsBySheet.get(sheetName);
        if (!rows) return false;
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
    }
    const dishReport = extractSalesDishReport(workbook);
    if (!dishReport) return false;

    const [dishRowsResult] = await connection.query(
        `SELECT IdProducto, Producto, Codigo FROM tblProductos
         WHERE IdTipoProducto = 1 AND Status = 0 ORDER BY Producto`
    );
    const dishes = dishRowsResult as DishCandidate[];

    await connection.beginTransaction();
    try {
        const relationRows = dishReport.rows.map(row => {
            const suggestion = suggestDish(row.code, row.name, dishes);
            return [row.code, row.name, suggestion?.dish.IdProducto ?? null,
                suggestion?.kind ?? 'sin_relacion', suggestion ? suggestion.confidence * 100 : 0];
        });
        const relationPlaceholders = relationRows.map(() => '(?, ?, ?, ?, ?)').join(',');
        await connection.query(
            `INSERT INTO tblVentasPlatillosRelaciones
                (ClaveReporte, NombreReporte, IdProducto, TipoRelacion, Confianza)
             VALUES ${relationPlaceholders}
             ON DUPLICATE KEY UPDATE NombreReporte = VALUES(NombreReporte), FechaAct = FechaAct`,
            relationRows.flat()
        );
        const quantityTotal = dishReport.rows.reduce((sum, row) => sum + row.quantity, 0);
        const subtotalTotal = dishReport.rows.reduce((sum, row) => sum + row.subtotal, 0);
        const [reportResultRaw] = await connection.query(
            `INSERT INTO tblVentasPlatillosReportes
                (IdImportacion, FechaInicio, FechaFin, SucursalReporte, NumeroArticulos, CantidadTotal, SubtotalTotal)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [storedImport.IdImportacion, dishReport.startDate, dishReport.endDate, dishReport.branch,
                dishReport.rows.length, quantityTotal, subtotalTotal]
        );
        const reportId = (reportResultRaw as ResultSetHeader).insertId;
        const placeholders = dishReport.rows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
        const values = dishReport.rows.flatMap(row => [
            reportId, row.code, row.name, row.group, row.quantity, row.subtotal, row.percentage,
        ]);
        await connection.query(
            `INSERT INTO tblVentasPlatillosEstadistica
                (IdReporte, ClaveReporte, NombreReporte, GrupoReporte, Cantidad, Subtotal, Porcentaje)
             VALUES ${placeholders}`,
            values
        );
        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    }
}

export async function GET(request: NextRequest) {
    let connection;
    try {
        const url = new URL(request.url);
        const projectId = validId(url.searchParams.get('projectId'));
        const reportId = validId(url.searchParams.get('reportId'));
        if (!projectId) return NextResponse.json({ success: false, message: 'El proyecto es obligatorio.' }, { status: 400 });
        connection = await getProjectConnection(projectId);

        let [reportsResult] = await connection.query(
            `SELECT r.IdReporte, r.FechaInicio, r.FechaFin, r.SucursalReporte, r.NumeroArticulos,
                    r.CantidadTotal, r.SubtotalTotal, r.FechaAct,
                    SUM(CASE WHEN rel.IdProducto IS NOT NULL THEN 1 ELSE 0 END) AS ArticulosRelacionados
             FROM tblVentasPlatillosReportes r
             LEFT JOIN tblVentasPlatillosEstadistica e ON e.IdReporte = r.IdReporte
             LEFT JOIN tblVentasPlatillosRelaciones rel ON rel.ClaveReporte = e.ClaveReporte
             GROUP BY r.IdReporte ORDER BY r.FechaInicio DESC, r.FechaFin DESC`
        );
        let reports = reportsResult as RowDataPacket[];
        if (!reports.length && await restoreLatestStoredReport(connection)) {
            [reportsResult] = await connection.query(
                `SELECT r.IdReporte, r.FechaInicio, r.FechaFin, r.SucursalReporte, r.NumeroArticulos,
                        r.CantidadTotal, r.SubtotalTotal, r.FechaAct,
                        SUM(CASE WHEN rel.IdProducto IS NOT NULL THEN 1 ELSE 0 END) AS ArticulosRelacionados
                 FROM tblVentasPlatillosReportes r
                 LEFT JOIN tblVentasPlatillosEstadistica e ON e.IdReporte = r.IdReporte
                 LEFT JOIN tblVentasPlatillosRelaciones rel ON rel.ClaveReporte = e.ClaveReporte
                 GROUP BY r.IdReporte ORDER BY r.FechaInicio DESC, r.FechaFin DESC`
            );
            reports = reportsResult as RowDataPacket[];
        }
        if (!reportId) return NextResponse.json({ success: true, data: { reports } });
        const report = reports.find(row => Number(row.IdReporte) === reportId);
        if (!report) return NextResponse.json({ success: false, message: 'No se encontró el periodo.' }, { status: 404 });

        const [detailsResult] = await connection.query(
            `SELECT e.IdDetalle, e.ClaveReporte, e.NombreReporte, e.GrupoReporte, e.Cantidad,
                    e.Subtotal, e.Porcentaje, rel.IdProducto, rel.TipoRelacion, rel.Confianza,
                    p.Producto AS PlatilloSistema, p.Codigo AS CodigoSistema
             FROM tblVentasPlatillosEstadistica e
             LEFT JOIN tblVentasPlatillosRelaciones rel ON rel.ClaveReporte = e.ClaveReporte
             LEFT JOIN tblProductos p ON p.IdProducto = rel.IdProducto
             WHERE e.IdReporte = ? ORDER BY e.Subtotal DESC, e.NombreReporte`,
            [reportId]
        );
        const [dishesResult] = await connection.query(
            `SELECT IdProducto, Producto, Codigo FROM tblProductos
             WHERE IdTipoProducto = 1 AND Status = 0 ORDER BY Producto`
        );
        return NextResponse.json({
            success: true,
            data: { report, reports, details: detailsResult, dishes: dishesResult },
        });
    } catch (error) {
        console.error('Error reading dish sales statistics:', error);
        return NextResponse.json({ success: false, message: 'No se pudieron consultar las ventas por platillo.' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const projectId = validId(body.projectId);
        const code = String(body.code ?? '').trim();
        const productId = body.productId == null ? null : validId(body.productId);
        if (!projectId || !code || (body.productId != null && !productId)) {
            return NextResponse.json({ success: false, message: 'La relación no es válida.' }, { status: 400 });
        }
        connection = await getProjectConnection(projectId);
        if (productId) {
            const [productsResult] = await connection.query(
                'SELECT IdProducto FROM tblProductos WHERE IdProducto = ? AND IdTipoProducto = 1 AND Status = 0 LIMIT 1',
                [productId]
            );
            if (!(productsResult as RowDataPacket[]).length) {
                return NextResponse.json({ success: false, message: 'El platillo seleccionado ya no está disponible.' }, { status: 404 });
            }
        }
        const [result] = await connection.query(
            `UPDATE tblVentasPlatillosRelaciones
             SET IdProducto = ?, TipoRelacion = ?, Confianza = ?, FechaAct = NOW()
             WHERE ClaveReporte = ?`,
            [productId, productId ? 'manual' : 'sin_relacion', productId ? 100 : 0, code]
        );
        if ((result as { affectedRows: number }).affectedRows === 0) {
            return NextResponse.json({ success: false, message: 'No se encontró el artículo del reporte.' }, { status: 404 });
        }
        return NextResponse.json({ success: true, message: productId ? 'Relación guardada.' : 'Relación eliminada.' });
    } catch (error) {
        console.error('Error updating dish relation:', error);
        return NextResponse.json({ success: false, message: 'No se pudo guardar la relación.' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
