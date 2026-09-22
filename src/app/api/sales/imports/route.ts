import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import * as XLSX from 'xlsx';
import { getProjectConnection } from '@/lib/dynamic-db';
import { DishCandidate, extractSalesDishReport, suggestDish } from '@/lib/sales-dish-stats';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = /\.(xlsx|xls)$/i;

type CellValue = string | number | boolean | null;

function serializeCell(value: unknown): CellValue {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value;
    if (value == null) return null;
    return String(value);
}

function reportDateFromName(name: string): string | null {
    const match = name.match(/(20\d{2})[-_](\d{2})[-_](\d{2})/);
    if (!match) return null;
    const candidate = `${match[1]}-${match[2]}-${match[3]}`;
    return Number.isNaN(Date.parse(`${candidate}T00:00:00Z`)) ? null : candidate;
}

export async function GET(request: NextRequest) {
    let connection;
    try {
        const projectId = Number(new URL(request.url).searchParams.get('projectId'));
        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'El proyecto es obligatorio.' }, { status: 400 });
        }
        connection = await getProjectConnection(projectId);
        const [rowsResult] = await connection.query(`
            SELECT i.IdImportacion, i.NombreArchivo, i.TamanoBytes, i.NumeroHojas,
                   i.NumeroFilas, i.FechaReporte, i.FechaImportacion,
                   GROUP_CONCAT(h.NombreHoja ORDER BY h.OrdenHoja SEPARATOR '|||') AS Hojas
            FROM tblVentasImportaciones i
            LEFT JOIN tblVentasImportacionHojas h ON h.IdImportacion = i.IdImportacion
            GROUP BY i.IdImportacion
            ORDER BY i.FechaImportacion DESC, i.IdImportacion DESC
            LIMIT 100
        `);
        const rows = rowsResult as RowDataPacket[];
        return NextResponse.json({
            success: true,
            data: rows.map(row => ({ ...row, Hojas: row.Hojas ? String(row.Hojas).split('|||') : [] })),
        });
    } catch (error) {
        console.error('Error listing sales imports:', error);
        return NextResponse.json({ success: false, message: 'No se pudo consultar el historial.' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const form = await request.formData();
        const projectId = Number(form.get('projectId'));
        const file = form.get('file');
        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'El proyecto es obligatorio.' }, { status: 400 });
        }
        if (!(file instanceof File) || !file.name || !ALLOWED_EXTENSIONS.test(file.name)) {
            return NextResponse.json({ success: false, message: 'Selecciona un archivo .xlsx o .xls.' }, { status: 400 });
        }
        if (file.size === 0 || file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ success: false, message: 'El archivo debe pesar entre 1 byte y 20 MB.' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const hash = createHash('sha256').update(buffer).digest('hex');
        let workbook: XLSX.WorkBook;
        try {
            workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellFormula: false });
        } catch {
            return NextResponse.json({ success: false, message: 'El archivo no es un Excel válido o está dañado.' }, { status: 400 });
        }
        if (!workbook.SheetNames.length) {
            return NextResponse.json({ success: false, message: 'El Excel no contiene hojas.' }, { status: 400 });
        }
        const dishReport = extractSalesDishReport(workbook);

        const sheets = workbook.SheetNames.map((name, order) => {
            const worksheet = workbook.Sheets[name];
            const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null, raw: true });
            const rows = rawRows
                .map((row, index) => ({ number: index + 1, values: row.map(serializeCell) }))
                .filter(row => row.values.some(value => value !== null && value !== ''));
            return {
                name,
                order,
                range: worksheet['!ref'] || null,
                rows,
                columns: rows.reduce((max, row) => Math.max(max, row.values.length), 0),
            };
        });
        const totalRows = sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);

        connection = await getProjectConnection(projectId);
        await connection.beginTransaction();
        let replacedExistingImport = false;
        const [existingResult] = await connection.query(
            'SELECT IdImportacion, NombreArchivo, FechaImportacion FROM tblVentasImportaciones WHERE HashArchivo = ? LIMIT 1',
            [hash]
        );
        const existing = existingResult as RowDataPacket[];
        if (existing.length) {
            // Los reportes estadísticos sí pueden volver a cargarse: se elimina
            // la importación anterior y se reconstruye para que también sirva al
            // actualizar instalaciones que importaron el archivo antes de existir
            // el módulo de ventas por platillo.
            if (dishReport) {
                await connection.query('DELETE FROM tblVentasImportaciones WHERE IdImportacion = ?', [existing[0].IdImportacion]);
                replacedExistingImport = true;
            } else {
                await connection.rollback();
                return NextResponse.json({
                    success: false,
                    duplicate: true,
                    message: `Este archivo ya fue importado como “${existing[0].NombreArchivo}”.`,
                }, { status: 409 });
            }
        }

        const [importResultRaw] = await connection.query(`
            INSERT INTO tblVentasImportaciones
                (NombreArchivo, HashArchivo, TamanoBytes, NumeroHojas, NumeroFilas, FechaReporte)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [file.name.slice(0, 255), hash, file.size, sheets.length, totalRows, reportDateFromName(file.name)]);
        const importResult = importResultRaw as ResultSetHeader;

        for (const sheet of sheets) {
            const [sheetResultRaw] = await connection.query(`
                INSERT INTO tblVentasImportacionHojas
                    (IdImportacion, NombreHoja, OrdenHoja, RangoOriginal, NumeroFilas, NumeroColumnas)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [importResult.insertId, sheet.name.slice(0, 255), sheet.order, sheet.range, sheet.rows.length, sheet.columns]);
            const sheetResult = sheetResultRaw as ResultSetHeader;
            if (sheet.rows.length) {
                const placeholders = sheet.rows.map(() => '(?, ?, ?)').join(',');
                const values = sheet.rows.flatMap(row => [sheetResult.insertId, row.number, JSON.stringify(row.values)]);
                await connection.query(
                    `INSERT INTO tblVentasImportacionFilas (IdHoja, NumeroFila, Datos) VALUES ${placeholders}`,
                    values
                );
            }
        }

        let replaced = replacedExistingImport;
        if (dishReport) {
            const [dishRowsResult] = await connection.query(
                `SELECT IdProducto, Producto, Codigo FROM tblProductos
                 WHERE IdTipoProducto = 1 AND Status = 0 ORDER BY Producto`
            );
            const dishes = dishRowsResult as DishCandidate[];
            const [existingReportResult] = await connection.query(
                `SELECT IdReporte, IdImportacion FROM tblVentasPlatillosReportes
                 WHERE FechaInicio = ? AND FechaFin = ? AND SucursalReporte = ? LIMIT 1`,
                [dishReport.startDate, dishReport.endDate, dishReport.branch]
            );
            const existingReports = existingReportResult as RowDataPacket[];
            const oldImportId = existingReports.length ? Number(existingReports[0].IdImportacion) : null;
            if (existingReports.length) {
                await connection.query('DELETE FROM tblVentasPlatillosReportes WHERE IdReporte = ?', [existingReports[0].IdReporte]);
                replaced = true;
            }

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
                [importResult.insertId, dishReport.startDate, dishReport.endDate, dishReport.branch,
                    dishReport.rows.length, quantityTotal, subtotalTotal]
            );
            const reportResult = reportResultRaw as ResultSetHeader;
            if (dishReport.rows.length) {
                const placeholders = dishReport.rows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
                const values = dishReport.rows.flatMap(row => [
                    reportResult.insertId, row.code, row.name, row.group, row.quantity, row.subtotal, row.percentage,
                ]);
                await connection.query(
                    `INSERT INTO tblVentasPlatillosEstadistica
                        (IdReporte, ClaveReporte, NombreReporte, GrupoReporte, Cantidad, Subtotal, Porcentaje)
                     VALUES ${placeholders}`,
                    values
                );
            }
            if (oldImportId && oldImportId !== importResult.insertId) {
                await connection.query('DELETE FROM tblVentasImportaciones WHERE IdImportacion = ?', [oldImportId]);
            }
        }
        await connection.commit();
        return NextResponse.json({
            success: true,
            message: 'Excel importado correctamente.',
            data: {
                id: importResult.insertId,
                sheets: sheets.length,
                rows: totalRows,
                salesItems: dishReport?.rows.length ?? 0,
                range: dishReport ? { start: dishReport.startDate, end: dishReport.endDate, branch: dishReport.branch } : null,
                replaced,
            },
        }, { status: 201 });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => undefined);
        console.error('Error importing sales workbook:', error);
        return NextResponse.json({ success: false, message: 'No se pudo importar el Excel.' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
