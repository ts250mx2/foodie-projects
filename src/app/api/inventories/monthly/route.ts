import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const monthStr = searchParams.get('month'); // 0-11
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || monthStr === null || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const month = parseInt(monthStr) + 1; // Convert to 1-12 for SQL
        const year = parseInt(yearStr);

        connection = await getProjectConnection(projectId);

        // Get inventory dates combining both tblInventarios and tblSucursalesInventarios
        const [rows] = (await connection.query(
            `SELECT 
                COALESCE(I.Dia, SI.Dia) as Dia,
                COALESCE(I.Mes, SI.Mes) as Mes,
                COALESCE(I.Anio, SI.Anio) as Anio,
                COALESCE(I.total, 0) as total,
                COALESCE(I.productCount, 0) as productCount,
                CASE WHEN SI.IdSucursal IS NOT NULL THEN 1 ELSE 0 END as isMarkedInventoryDay
             FROM (
                SELECT Dia, Mes, Anio, 
                       SUM(Precio * Cantidad) as total,
                       COUNT(IdProducto) as productCount
                FROM tblInventarios
                WHERE IdSucursal = ? AND Mes = ? AND Anio = ?
                GROUP BY Dia, Mes, Anio
             ) I
             RIGHT JOIN tblSucursalesInventarios SI 
                ON I.Dia = SI.Dia AND I.Mes = SI.Mes AND I.Anio = SI.Anio
             WHERE SI.IdSucursal = ? AND SI.Mes = ? AND SI.Anio = ?
             
             UNION
             
             SELECT I.Dia, I.Mes, I.Anio,
                    SUM(I.Precio * I.Cantidad) as total,
                    COUNT(I.IdProducto) as productCount,
                    CASE WHEN SI.IdSucursal IS NOT NULL THEN 1 ELSE 0 END as isMarkedInventoryDay
             FROM tblInventarios I
             LEFT JOIN tblSucursalesInventarios SI 
                ON I.IdSucursal = SI.IdSucursal AND I.Dia = SI.Dia AND I.Mes = SI.Mes AND I.Anio = SI.Anio
             WHERE I.IdSucursal = ? AND I.Mes = ? AND I.Anio = ?
                AND NOT EXISTS (
                    SELECT 1 FROM tblSucursalesInventarios SI2
                    WHERE SI2.IdSucursal = I.IdSucursal 
                        AND SI2.Dia = I.Dia AND SI2.Mes = I.Mes AND SI2.Anio = I.Anio
                )
             GROUP BY I.Dia, I.Mes, I.Anio, SI.IdSucursal
             
             ORDER BY Dia`,
            [branchId, month, year, branchId, month, year, branchId, month, year]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching monthly inventory dates:', error);
        return NextResponse.json({ success: false, message: 'Error fetching monthly inventory dates' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

