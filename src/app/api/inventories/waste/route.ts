import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const month = searchParams.get('month'); // 0-11
        const year = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || month === null || !year) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const monthNum = parseInt(month) + 1; // Convert to 1-12 for SQL
        connection = await getProjectConnection(projectId);

        // Fetch waste records for the month/year/branch
        const [rows] = await connection.query(
            `SELECT m.*, v.Producto, v.UnidadMedidaInventario
             FROM tblMermas m
             INNER JOIN tblProductos p ON m.IdProducto = p.IdProducto
             LEFT JOIN vlProductos v ON m.IdProducto = v.IdProducto
             WHERE m.Mes = ? AND m.Anio = ? AND m.IdSucursal = ?
             AND p.Status != 2
             ORDER BY m.Dia, v.Producto`,
            [monthNum, year, branchId]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching waste records:', error);
        return NextResponse.json({ success: false, message: 'Error fetching waste records' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, day, month, year, productId, quantity, price } = body;

        if (!projectId || !branchId || day === undefined || month === null || !year || !productId || quantity === undefined || price === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const monthNum = month + 1; // Convert to 1-12 for SQL
        connection = await getProjectConnection(projectId);

        // Insert or update waste record
        // Assuming unique key on (IdSucursal, Dia, Mes, Anio, IdProducto)
        await connection.query(
            `INSERT INTO tblMermas (IdSucursal, Dia, Mes, Anio, IdProducto, Cantidad, Precio, FechaAct)
             VALUES (?, ?, ?, ?, ?, ?, ?, Now())
             ON DUPLICATE KEY UPDATE Cantidad = ?, Precio = ?, FechaAct = Now()`,
            [branchId, day, monthNum, year, productId, quantity, price, quantity, price]
        );

        return NextResponse.json({ success: true, message: 'Waste record saved successfully' });
    } catch (error) {
        console.error('Error saving waste record:', error);
        return NextResponse.json({ success: false, message: 'Error saving waste record' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const day = searchParams.get('day');
        const month = searchParams.get('month'); // 0-11
        const year = searchParams.get('year');
        const productIdStr = searchParams.get('productId');

        if (!projectIdStr || !branchIdStr || !day || month === null || !year || !productIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const monthNum = parseInt(month) + 1;
        const productId = parseInt(productIdStr);

        connection = await getProjectConnection(projectId);

        await connection.query(
            `DELETE FROM tblMermas 
             WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdSucursal = ? AND IdProducto = ?`,
            [day, monthNum, year, branchId, productId]
        );

        return NextResponse.json({ success: true, message: 'Waste record deleted successfully' });
    } catch (error) {
        console.error('Error deleting waste record:', error);
        return NextResponse.json({ success: false, message: 'Error deleting waste record' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
