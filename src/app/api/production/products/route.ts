import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        const query = `
            SELECT 
                A.IdProducto, 
                A.Producto, 
                A.Codigo, 
                A.IdCategoria, 
                A.IdPresentacion, 
                A.Precio, 
                A.IVA, 
                A.RutaFoto, 
                A.Status,
                B.Categoria, 
                C.Presentacion
            FROM tblProductos A
            INNER JOIN tblCategorias B ON A.IdCategoria = B.IdCategoria
            INNER JOIN tblPresentaciones C ON A.IdPresentacion = C.IdPresentacion
            WHERE A.IdTipoProducto IN (1, 2) AND A.Status = 0
            ORDER BY A.Producto
        `;

        const [rows] = (await connection.query(query);

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching production products:', error);
        return NextResponse.json({ success: false, message: 'Error fetching products' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

