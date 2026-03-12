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
        const [rows] = await connection.query(
            `SELECT 
                DAY(SI.FechaInventario) as Dia,
                MONTH(SI.FechaInventario) as Mes,
                YEAR(SI.FechaInventario) as Anio,
                COALESCE(I.total, 0) as total,
                COALESCE(I.productCount, 0) as productCount,
                1 as isMarkedInventoryDay
             FROM (
                SELECT Dia, Mes, Anio, 
                       SUM(Precio * Cantidad) as total,
                       COUNT(IdProducto) as productCount
                FROM tblInventarios
                WHERE IdSucursal = ? AND Mes = ? AND Anio = ?
                GROUP BY Dia, Mes, Anio
             ) I
             RIGHT JOIN tblSucursalesInventarios SI 
                ON I.Dia = DAY(SI.FechaInventario) AND I.Mes = MONTH(SI.FechaInventario) AND I.Anio = YEAR(SI.FechaInventario)
             WHERE SI.IdSucursal = ? AND MONTH(SI.FechaInventario) = ? AND YEAR(SI.FechaInventario) = ?
             
             UNION
             
             SELECT I.Dia, I.Mes, I.Anio,
                    SUM(I.Precio * I.Cantidad) as total,
                    COUNT(I.IdProducto) as productCount,
                    CASE WHEN SI.IdSucursal IS NOT NULL THEN 1 ELSE 0 END as isMarkedInventoryDay
             FROM tblInventarios I
             LEFT JOIN tblSucursalesInventarios SI 
                ON I.IdSucursal = SI.IdSucursal 
                AND I.Dia = DAY(SI.FechaInventario) 
                AND I.Mes = MONTH(SI.FechaInventario) 
                AND I.Anio = YEAR(SI.FechaInventario)
             WHERE I.IdSucursal = ? AND I.Mes = ? AND I.Anio = ?
                AND NOT EXISTS (
                    SELECT 1 FROM tblSucursalesInventarios SI2
                    WHERE SI2.IdSucursal = I.IdSucursal 
                        AND DAY(SI2.FechaInventario) = I.Dia 
                        AND MONTH(SI2.FechaInventario) = I.Mes 
                        AND YEAR(SI2.FechaInventario) = I.Anio
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

