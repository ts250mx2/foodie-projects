import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

/** Máximo de movimientos de kardex devueltos por consulta. */
const MOVEMENTS_LIMIT = 500;

/**
 * Kardex de almacén: movimientos (entradas, salidas y ajustes) por sucursal,
 * opcionalmente filtrados por producto y rango de fechas.
 */
export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const productIdStr = searchParams.get('productId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!projectIdStr || !branchIdStr) {
            return NextResponse.json({ success: false, message: 'projectId and branchId are required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        let query = `
            SELECT
                m.IdMovimiento,
                m.IdProducto,
                m.TipoMovimiento,
                m.Origen,
                m.IdOrdenCompra,
                m.Cantidad,
                m.CostoUnitario,
                m.ExistenciaAnterior,
                m.ExistenciaNueva,
                m.Unidad,
                m.Notas,
                m.FechaMovimiento,
                p.Producto,
                p.Codigo
            FROM tblAlmacenMovimientos m
            JOIN tblProductos p ON p.IdProducto = m.IdProducto
            WHERE m.IdSucursal = ?
        `;
        const queryParams: any[] = [parseInt(branchIdStr)];

        if (productIdStr) {
            query += ' AND m.IdProducto = ?';
            queryParams.push(parseInt(productIdStr));
        }
        if (startDate) {
            query += ' AND m.FechaMovimiento >= ?';
            queryParams.push(`${startDate} 00:00:00`);
        }
        if (endDate) {
            query += ' AND m.FechaMovimiento <= ?';
            queryParams.push(`${endDate} 23:59:59`);
        }

        query += ` ORDER BY m.FechaMovimiento DESC, m.IdMovimiento DESC LIMIT ${MOVEMENTS_LIMIT}`;

        const [rows] = await connection.query(query, queryParams);

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching warehouse movements:', error);
        return NextResponse.json({ success: false, message: 'Error fetching warehouse movements' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
