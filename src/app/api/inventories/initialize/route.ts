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

        // Check if inventory already exists for this day
        const [existing] = await connection.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM tblInventarios WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdSucursal = ?',
            [day, monthNum, year, branchId]
        );

        const alreadyExists = existing[0].count > 0;

        if (!alreadyExists) {
            // First time initialization - copy from previous inventory
            const [previousDay] = await connection.query<RowDataPacket[]>(
                `SELECT DISTINCT Dia, Mes, Anio 
                 FROM tblInventarios 
                 WHERE IdSucursal = ? 
                 AND (Anio < ? OR (Anio = ? AND Mes < ?) OR (Anio = ? AND Mes = ? AND Dia < ?))
                 ORDER BY Anio DESC, Mes DESC, Dia DESC 
                 LIMIT 1`,
                [branchId, year, year, monthNum, year, monthNum, day]
            );

            if (previousDay.length > 0) {
                // Copy products from previous inventory with quantity = 0
                await connection.query<ResultSetHeader>(
                    `INSERT INTO tblInventarios (IdProducto, Dia, Mes, Anio, FechaInventario, IdSucursal, Cantidad, Precio, FechaAct)
                     SELECT IdProducto, ?, ?, ?, ?, ?, 0, Precio, NOW()
                     FROM tblInventarios
                     WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdSucursal = ?`,
                    [day, monthNum, year, inventoryDate, branchId, previousDay[0].Dia, previousDay[0].Mes, previousDay[0].Anio, branchId]
                );
            } else {
                // No previous inventory, initialize with all active products
                await connection.query<ResultSetHeader>(
                    `INSERT INTO tblInventarios (IdProducto, Dia, Mes, Anio, FechaInventario, IdSucursal, Cantidad, Precio, FechaAct)
                     SELECT IdProducto, ?, ?, ?, ?, ?, 0, Precio, NOW()
                     FROM tblProductos
                     WHERE Status = 0`,
                    [day, monthNum, year, inventoryDate, branchId]
                );
            }
        }

        // ALWAYS add any new products that aren't in this day's inventory
        // This runs whether it's the first time or subsequent opens
        await connection.query<ResultSetHeader>(
            `INSERT INTO tblInventarios (IdProducto, Dia, Mes, Anio, FechaInventario, IdSucursal, Cantidad, Precio, FechaAct)
             SELECT P.IdProducto, ?, ?, ?, ?, ?, 0, P.Precio, NOW()
             FROM tblProductos P
             WHERE P.Status = 0
             AND P.IdProducto NOT IN (
                 SELECT IdProducto FROM tblInventarios 
                 WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdSucursal = ?
             )`,
            [day, monthNum, year, inventoryDate, branchId, day, monthNum, year, branchId]
        );

        return NextResponse.json({
            success: true,
            message: alreadyExists ? 'Inventory updated with new products' : 'Inventory initialized successfully',
            alreadyExists
        });
    } catch (error) {
        console.error('Error initializing inventory:', error);
        return NextResponse.json({ success: false, message: 'Error initializing inventory' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
