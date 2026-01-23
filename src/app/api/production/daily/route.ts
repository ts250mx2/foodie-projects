import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const dateStr = searchParams.get('date');

        if (!projectIdStr || !branchIdStr || !dateStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);

        // Parse date to ensure format YYYY-MM-DD
        const date = new Date(dateStr);
        const formattedDate = date.toISOString().split('T')[0];

        connection = await getProjectConnection(projectId);

        const query = `
            SELECT 
                p.IdProduccion,
                p.IdProducto,
                p.Cantidad,
                p.Precio,
                p.FechaProduccion,
                prod.Producto,
                prod.Codigo,
                cat.Categoria,
                pres.Presentacion,
                (p.Cantidad * p.Precio) as Total
            FROM tblProduccion p
            INNER JOIN tblProductos prod ON p.IdProducto = prod.IdProducto
            LEFT JOIN tblCategorias cat ON prod.IdCategoria = cat.IdCategoria
            LEFT JOIN tblPresentaciones pres ON prod.IdPresentacion = pres.IdPresentacion
            WHERE p.IdSucursal = ? AND DATE(p.FechaProduccion) = ?
            ORDER BY prod.Producto ASC
        `;

        const [rows] = (await connection.query(query, [branchId, formattedDate]);

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching daily production:', error);
        return NextResponse.json({ success: false, message: 'Error fetching production' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, productId, quantity, price, date } = body;

        if (!projectId || !branchId || !productId || !quantity || price === undefined || !date) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        // Parse date for FechaProduccion
        const prodDate = new Date(date);
        const formattedDate = prodDate.toISOString().split('T')[0];

        connection = await getProjectConnection(projectId);

        const query = `
            INSERT INTO tblProduccion 
            (IdSucursal, IdProducto, FechaProduccion, Cantidad, Precio, Exploto, FechaAct) 
            VALUES (?, ?, ?, ?, ?, 0, NOW())
        `;

        const [result] = (await connection.query(query, [
            branchId,
            productId,
            formattedDate,
            quantity,
            price
        ]);

        return NextResponse.json({
            success: true,
            message: 'Production item added successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error saving daily production:', error);
        return NextResponse.json({ success: false, message: 'Error saving production' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const productionIdStr = searchParams.get('productionId');

        if (!projectIdStr || !productionIdStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        await connection.query('DELETE FROM tblProduccion WHERE IdProduccion = ?', [productionIdStr]);

        return NextResponse.json({ success: true, message: 'Production item deleted' });
    } catch (error) {
        console.error('Error deleting production item:', error);
        return NextResponse.json({ success: false, message: 'Error deleting item' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

