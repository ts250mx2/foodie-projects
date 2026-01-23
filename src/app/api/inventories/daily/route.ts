import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const dayStr = searchParams.get('day');
        const monthStr = searchParams.get('month'); // 0-11
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || !dayStr || monthStr === null || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const day = parseInt(dayStr);
        const month = parseInt(monthStr) + 1; // Convert to 1-12 for SQL
        const year = parseInt(yearStr);

        connection = await getProjectConnection(projectId);

        // Get inventory entries for the selected day with product and category information
        const [rows] = await connection.query(
            `SELECT I.IdProducto, I.Cantidad, I.Precio, I.FechaInventario, I.Dia, I.Mes, I.Anio, I.IdSucursal,
                    P.Codigo, P.Producto, PR.Presentacion, P.IdCategoria,
                    C.Categoria,
                    (I.Cantidad * I.Precio) as Total
             FROM tblInventarios I
             INNER JOIN tblProductos P ON I.IdProducto = P.IdProducto
             LEFT JOIN tblPresentaciones PR ON P.IdPresentacion = PR.IdPresentacion
             LEFT JOIN tblCategorias C ON P.IdCategoria = C.IdCategoria
             WHERE I.IdSucursal = ? AND I.Dia = ? AND I.Mes = ? AND I.Anio = ?
             ORDER BY C.Categoria, P.Producto`,
            [branchId, day, month, year]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching inventory entries:', error);
        return NextResponse.json({ success: false, message: 'Error fetching inventory entries' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, day, month, year, productId, quantity, price, inventoryDate } = body;

        if (!projectId || !branchId || day === undefined || month === undefined || !year || !productId || quantity === undefined || price === undefined || !inventoryDate) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const monthNum = month + 1; // Convert to 1-12 for SQL

        connection = await getProjectConnection(projectId);

        // Use REPLACE INTO to insert or update
        await connection.query(
            `REPLACE INTO tblInventarios (IdProducto, Dia, Mes, Anio, IdSucursal, FechaInventario, Precio, Cantidad, FechaAct)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [productId, day, monthNum, year, branchId, inventoryDate, price, quantity]
        );

        return NextResponse.json({
            success: true,
            message: 'Inventory entry saved successfully'
        });
    } catch (error) {
        console.error('Error saving inventory entry:', error);
        return NextResponse.json({ success: false, message: 'Error saving inventory entry' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, day, month, year, updates } = body;

        if (!projectId || !branchId || day === undefined || month === undefined || !year || !Array.isArray(updates)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const monthNum = month + 1; // Convert to 1-12 for SQL

        connection = await getProjectConnection(projectId);

        // Start transaction
        await connection.beginTransaction();

        try {
            // Update all products in batch
            for (const update of updates) {
                await connection.query(
                    `UPDATE tblInventarios 
                     SET Cantidad = ?, FechaAct = NOW()
                     WHERE IdProducto = ? AND Dia = ? AND Mes = ? AND Anio = ? AND IdSucursal = ?`,
                    [update.quantity, update.productId, day, monthNum, year, branchId]
                );
            }

            // Commit transaction
            await connection.commit();

            return NextResponse.json({
                success: true,
                message: 'Inventory updated successfully'
            });
        } catch (error) {
            // Rollback on error
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error updating inventory:', error);
        return NextResponse.json({ success: false, message: 'Error updating inventory' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const productIdStr = searchParams.get('productId');
        const branchIdStr = searchParams.get('branchId');
        const dayStr = searchParams.get('day');
        const monthStr = searchParams.get('month'); // 0-11
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !productIdStr || !branchIdStr || !dayStr || monthStr === null || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const productId = parseInt(productIdStr);
        const branchId = parseInt(branchIdStr);
        const day = parseInt(dayStr);
        const month = parseInt(monthStr) + 1; // Convert to 1-12 for SQL
        const year = parseInt(yearStr);

        connection = await getProjectConnection(projectId);

        // Delete the inventory entry using composite primary key
        await connection.query(
            'DELETE FROM tblInventarios WHERE IdProducto = ? AND Dia = ? AND Mes = ? AND Anio = ? AND IdSucursal = ?',
            [productId, day, month, year, branchId]
        );

        return NextResponse.json({
            success: true,
            message: 'Inventory entry deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting inventory entry:', error);
        return NextResponse.json({ success: false, message: 'Error deleting inventory entry' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

