import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import { getProjectConnection } from '@/lib/dynamic-db';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    let connection;
    try {
        const { id } = await context.params;
        const importId = Number(id);
        const url = new URL(request.url);
        const projectId = Number(url.searchParams.get('projectId'));
        const sheetId = Number(url.searchParams.get('sheetId'));
        const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
        const pageSize = Math.min(200, Math.max(25, Number(url.searchParams.get('pageSize')) || 75));

        if (!Number.isInteger(projectId) || projectId <= 0 || !Number.isInteger(importId) || importId <= 0) {
            return NextResponse.json({ success: false, message: 'La importación solicitada no es válida.' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        const [importsResult] = await connection.query(
            `SELECT IdImportacion, NombreArchivo, TamanoBytes, NumeroHojas, NumeroFilas,
                    FechaReporte, FechaImportacion
             FROM tblVentasImportaciones WHERE IdImportacion = ? LIMIT 1`,
            [importId]
        );
        const imports = importsResult as RowDataPacket[];
        if (!imports.length) {
            return NextResponse.json({ success: false, message: 'No se encontró la importación.' }, { status: 404 });
        }

        const [sheetsResult] = await connection.query(
            `SELECT IdHoja, NombreHoja, OrdenHoja, RangoOriginal, NumeroFilas, NumeroColumnas
             FROM tblVentasImportacionHojas WHERE IdImportacion = ? ORDER BY OrdenHoja`,
            [importId]
        );
        const sheets = sheetsResult as RowDataPacket[];

        if (!Number.isInteger(sheetId) || sheetId <= 0) {
            return NextResponse.json({ success: true, data: { import: imports[0], sheets } });
        }

        const sheet = sheets.find(item => Number(item.IdHoja) === sheetId);
        if (!sheet) {
            return NextResponse.json({ success: false, message: 'La hoja no pertenece a esta importación.' }, { status: 404 });
        }
        const offset = (page - 1) * pageSize;
        const [rowsResult] = await connection.query(
            `SELECT NumeroFila, Datos FROM tblVentasImportacionFilas
             WHERE IdHoja = ? ORDER BY NumeroFila LIMIT ? OFFSET ?`,
            [sheetId, pageSize, offset]
        );
        const rows = (rowsResult as RowDataPacket[]).map(row => ({
            number: Number(row.NumeroFila),
            values: typeof row.Datos === 'string' ? JSON.parse(row.Datos) : row.Datos,
        }));
        return NextResponse.json({
            success: true,
            data: {
                import: imports[0], sheets, sheet, rows, page, pageSize,
                totalPages: Math.max(1, Math.ceil(Number(sheet.NumeroFilas) / pageSize)),
            },
        });
    } catch (error) {
        console.error('Error reading sales import:', error);
        return NextResponse.json({ success: false, message: 'No se pudo abrir la importación.' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
