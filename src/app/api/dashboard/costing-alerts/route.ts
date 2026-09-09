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

        // El % de costo se mide contra el precio SIN impuesto, igual que en el
        // grid de platillos y en el modal de costeo. El impuesto no es ingreso
        // del negocio: se cobra y se entrega, así que incluirlo en el
        // denominador hace ver el costo más bajo de lo que es.
        //
        // No se usa v.AlertaCosto ni v.PorcentajeCosto de la vista: esos
        // comparan contra el precio con impuesto y dejaban fuera del tablero
        // platillos que sí estaban pasados. Se calcula aquí para no tener que
        // migrar vlPlatillos en la base de cada proyecto.
        const [rows] = (await connection.query(
            `SELECT * FROM (
                SELECT
                    v.IdProducto,
                    v.Producto,
                    v.Codigo,
                    v.Precio,
                    v.Costo,
                    COALESCE(p.IVA, 0) AS IVA,
                    (v.Costo / (v.Precio - v.Precio * COALESCE(p.IVA, 0) / 100)) * 100 AS PorcentajeCosto,
                    v.PorcentajeCostoIdeal,
                    v.SeccionMenu,
                    c.Categoria,
                    c.ImagenCategoria
                 FROM vlPlatillos v
                 LEFT JOIN tblProductos p ON v.IdProducto = p.IdProducto
                 LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
                 WHERE v.Status = 0
                   AND v.PorcentajeCostoIdeal IS NOT NULL
                   AND v.PorcentajeCostoIdeal > 0
                   AND v.Precio > 0
                   AND COALESCE(p.IVA, 0) < 100
             ) t
             WHERE t.PorcentajeCosto > t.PorcentajeCostoIdeal
             ORDER BY (t.PorcentajeCosto - t.PorcentajeCostoIdeal) DESC, t.Producto ASC`
        )) as [RowDataPacket[], FieldPacket[]];

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching costing alerts:', error);
        return NextResponse.json({ success: false, message: 'Error fetching costing alerts' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
