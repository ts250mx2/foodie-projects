import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const { id } = await params;
        const idOrdenCompra = id;

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // 1. Fetch Header
        const [headerRows] = await connection.query(`
            SELECT 
                oc.*, 
                p.Proveedor,
                s.Sucursal
            FROM tblOrdenesCompra oc
            JOIN tblProveedores p ON oc.IdProveedor = p.IdProveedor
            JOIN tblSucursales s ON oc.IdSucursal = s.IdSucursal
            WHERE oc.IdOrdenCompra = ?
        `, [idOrdenCompra]);

        if ((headerRows as any[]).length === 0) {
            return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
        }

        // 2. Fetch Details
        const [detailRows] = await connection.query(`
            SELECT 
                ocd.*,
                p.Producto,
                p.Codigo,
                c.Categoria
            FROM tblOrdenesCompraDetalle ocd
            JOIN tblProductos p ON ocd.IdProducto = p.IdProducto
            LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
            WHERE ocd.IdOrdenCompra = ?
        `, [idOrdenCompra]);

        return NextResponse.json({ 
            success: true, 
            data: {
                header: (headerRows as any[])[0],
                items: detailRows
            }
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        return NextResponse.json({ success: false, message: 'Error fetching order details' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
