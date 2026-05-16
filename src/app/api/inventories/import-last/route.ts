import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, day, month, year, inventoryDate } = body;

        if (!projectId || !branchId || day === undefined || month === undefined || !year || !inventoryDate) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const monthNum = month + 1; // Convert to 1-12 for SQL
        connection = await getProjectConnection(projectId);

        // 1. Find the latest day that has any inventory recorded for this branch before the selected date
        const [previousDay] = await connection.query(
            `SELECT Dia, Mes, Anio 
             FROM tblInventarios 
             WHERE IdSucursal = ? 
             AND (Anio < ? OR (Anio = ? AND Mes < ?) OR (Anio = ? AND Mes = ? AND Dia < ?))
             AND Cantidad > 0
             ORDER BY Anio DESC, Mes DESC, Dia DESC 
             LIMIT 1`,
            [branchId, year, year, monthNum, year, monthNum, day]
        ) as [RowDataPacket[], any];

        if (previousDay.length === 0) {
            return NextResponse.json({ success: false, message: 'No previous inventory found' }, { status: 404 });
        }

        const prev = previousDay[0];

        // 2. Import records from the previous day into the current day
        // We use INSERT ... ON DUPLICATE KEY UPDATE to overwrite current values with previous ones
        await connection.query(
            `INSERT INTO tblInventarios (IdProducto, Dia, Mes, Anio, FechaInventario, IdSucursal, Cantidad, Precio, FechaAct)
             SELECT i.IdProducto, ?, ?, ?, ?, ?, i.Cantidad, COALESCE(v.CostoInventario, i.Precio), NOW()
             FROM tblInventarios i
             INNER JOIN tblProductos p ON i.IdProducto = p.IdProducto
             LEFT JOIN vlProductos v ON i.IdProducto = v.IdProducto
             WHERE i.Dia = ? AND i.Mes = ? AND i.Anio = ? AND i.IdSucursal = ?
             AND p.Status != 2
             ON DUPLICATE KEY UPDATE 
                Cantidad = VALUES(Cantidad),
                Precio = VALUES(Precio),
                FechaAct = NOW()`,
            [day, monthNum, year, inventoryDate, branchId, prev.Dia, prev.Mes, prev.Anio, branchId]
        );

        return NextResponse.json({
            success: true,
            message: `Inventory imported from ${prev.Dia}/${prev.Mes}/${prev.Anio} successfully`
        });
    } catch (error) {
        console.error('Error importing last inventory:', error);
        return NextResponse.json({ success: false, message: 'Error importing inventory' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
