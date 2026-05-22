import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, FieldPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Missing projectId' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        const [rows] = (await connection.query(
            `SELECT
                v.IdProducto,
                v.Producto,
                v.Codigo,
                v.Precio,
                v.Costo,
                v.PorcentajeCosto,
                v.PorcentajeCostoIdeal,
                v.SeccionMenu,
                c.Categoria,
                c.ImagenCategoria
             FROM vlPlatillos v
             LEFT JOIN tblProductos p ON v.IdProducto = p.IdProducto
             LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
             WHERE v.Status = 0
               AND v.AlertaCosto = 1
               AND v.PorcentajeCostoIdeal IS NOT NULL
               AND v.PorcentajeCostoIdeal > 0
             ORDER BY (v.PorcentajeCosto - v.PorcentajeCostoIdeal) DESC, v.Producto ASC`
        )) as [RowDataPacket[], FieldPacket[]];

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching costing alerts:', error);
        return NextResponse.json({ success: false, message: 'Error fetching costing alerts' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
