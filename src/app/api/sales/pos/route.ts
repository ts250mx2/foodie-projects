import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const dayStr = searchParams.get('day');
        const monthStr = searchParams.get('month');
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || !dayStr || monthStr === null || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        const [rows] = await connection.query(
            `SELECT 
                IdVentaPOS as idVentaPOS,
                IdProducto as idProducto,
                Codigo as codigo,
                Descripcion as descripcion,
                Categoria as categoria,
                Cantidad as cantidad,
                PrecioUnitario as precioUnitario,
                Total as total
             FROM tblVentasPOS 
             WHERE IdSucursal = ? AND Dia = ? AND Mes = ? AND Anio = ?
             ORDER BY IdVentaPOS ASC`,
            [branchIdStr, dayStr, monthStr, yearStr]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching POS sales:', error);
        return NextResponse.json({ success: false, message: 'Error fetching POS sales' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, day, month, year, items } = body;

        if (!projectId || !branchId || !day || month === null || !year || !Array.isArray(items)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        // Start transaction for bulk insert
        await connection.beginTransaction();

        try {
            // 1. Delete existing for that day to avoid duplicates if re-pasted
            await connection.query(
                `DELETE FROM tblVentasPOS 
                 WHERE IdSucursal = ? AND Dia = ? AND Mes = ? AND Anio = ?`,
                [branchId, day, month, year]
            );

            // 2. Insert new items
            if (items.length > 0) {
                const values = items.map(item => [
                    item.idProducto || null,
                    branchId,
                    day,
                    month,
                    year,
                    item.codigo,
                    item.descripcion,
                    item.categoria,
                    item.cantidad,
                    item.precioUnitario || 0,
                    item.total,
                    new Date()
                ]);

                await connection.query(
                    `INSERT INTO tblVentasPOS 
                     (IdProducto, IdSucursal, Dia, Mes, Anio, Codigo, Descripcion, Categoria, Cantidad, PrecioUnitario, Total, FechaAct)
                     VALUES ?`,
                    [values]
                );
            }

            await connection.commit();
            return NextResponse.json({ success: true, message: 'POS Sales saved successfully' });
        } catch (err) {
            await connection.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error saving POS sales:', error);
        return NextResponse.json({ success: false, message: 'Error saving POS sales' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
