import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, producto, codigo, idCategoria, idCategoriaRecetario, idPresentacion, precio, iva, archivoImagen, nombreArchivo, conversionSimple, idPresentacionConversion, pesoFinal, pesoInicial, idTipoProducto, idSeccionMenu, porcentajeCostoIdeal } = body;

        // Validation: Required for all
        if (!projectId || !producto || !codigo || precio === undefined || iva === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        // Required only if NOT a Dish (type 1)
        if (idTipoProducto !== 1 && (!idCategoria || !idPresentacion)) {
            return NextResponse.json({ success: false, message: 'Category and Presentation are required' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        const [result] = await connection.query(
            `UPDATE tblProductos SET Producto = ?, Codigo = ?, IdCategoria = ?, IdCategoriaRecetario = ?, IdPresentacion = ?, Precio = ?, IVA = ?, ArchivoImagen = ?, NombreArchivo = ?, ConversionSimple = ?, IdPresentacionConversion = ?, PesoFinal = ?, PesoInicial = ?, IdSeccionMenu = ?, PorcentajeCostoIdeal = ?, FechaAct = Now() WHERE IdProducto = ?`,
            [producto, codigo, idCategoria, idCategoriaRecetario /* Allow 0 */, idPresentacion, precio, iva, archivoImagen || null, nombreArchivo || null, conversionSimple || 0, idPresentacionConversion || null, pesoFinal || 0, pesoInicial || 0, idSeccionMenu || null, porcentajeCostoIdeal || null, id]
        );

        if ((result as any).affectedRows === 0) {
            return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Product updated successfully'
        });
    } catch (error) {
        console.error('Error updating product:', error);
        return NextResponse.json({ success: false, message: 'Error updating product' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // Soft delete: Set Status = 2
        const [result] = await connection.query(
            'UPDATE tblProductos SET Status = 2, FechaAct = Now() WHERE IdProducto = ?',
            [id]
        );

        if ((result as any).affectedRows === 0) {
            return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        return NextResponse.json({ success: false, message: 'Error deleting product' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
