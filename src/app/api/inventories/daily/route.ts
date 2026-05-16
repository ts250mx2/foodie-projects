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

        // Workaround for Division by 0 in vlProductos view
        await connection.query("SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, 'ERROR_FOR_DIVISION_BY_ZERO', ''))");

        // Get inventory entries for the selected day with product and category information
        const [rows] = await connection.query(
            `SELECT I.IdProducto, I.Cantidad, COALESCE(v.CostoInventario, I.Precio) as Precio, I.FechaInventario, I.Dia, I.Mes, I.Anio, I.IdSucursal,
                    v.Codigo AS Codigo, v.Producto AS Producto, 
                    v.UnidadMedidaInventario AS Presentacion, 
                    v.IdCategoria AS IdCategoria,
                    v.Categoria AS Categoria,
                    v.ImagenCategoria AS ImagenCategoria,
                    v.ArchivoImagen AS ArchivoImagen,
                    (I.Cantidad * COALESCE(v.CostoInventario, I.Precio)) as Total
             FROM tblInventarios I
             INNER JOIN tblProductos p ON I.IdProducto = p.IdProducto
             LEFT JOIN vlProductos v ON I.IdProducto = v.IdProducto
             WHERE I.IdSucursal = ? AND I.Dia = ? AND I.Mes = ? AND I.Anio = ?
             AND p.Status != 2
             ORDER BY v.Categoria, v.Producto`,
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

        // Workaround for Division by 0 in vlProductos view
        await connection.query("SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, 'ERROR_FOR_DIVISION_BY_ZERO', ''))");

        // Use INSERT ... ON DUPLICATE KEY UPDATE to prioritize CostoInventario from vlProductos
        // If not in view, we keep the incoming price (or existing one)
        await connection.query(
            `INSERT INTO tblInventarios (IdProducto, Dia, Mes, Anio, IdSucursal, FechaInventario, Precio, Cantidad, FechaAct)
             SELECT ?, ?, ?, ?, ?, ?, COALESCE((SELECT v.CostoInventario FROM vlProductos v WHERE v.IdProducto = ? LIMIT 1), ?), ?, NOW()
             ON DUPLICATE KEY UPDATE 
                Precio = VALUES(Precio),
                Cantidad = VALUES(Cantidad),
                FechaAct = NOW()`,
            [productId, day, monthNum, year, branchId, inventoryDate, productId, price, quantity]
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
                // Update quantity and also refresh price with the latest CostoInventario from the view
                await connection.query(
                    `UPDATE tblInventarios I
                     SET I.Cantidad = ?, 
                         I.Precio = (
                            SELECT CostoInventario 
                            FROM vlProductos 
                            WHERE IdProducto = ?
                         ),
                         I.FechaAct = NOW()
                     WHERE I.IdProducto = ? AND I.Dia = ? AND I.Mes = ? AND I.Anio = ? AND I.IdSucursal = ?`,
                    [update.quantity, update.productId, update.productId, day, monthNum, year, branchId]
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

