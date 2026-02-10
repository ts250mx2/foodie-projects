import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';
import fs from 'fs';
import path from 'path';

export async function PUT(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await props.params;
        const body = await request.json();

        // Persist log to file
        const logData = `[${new Date().toISOString()}] PUT /api/products/${id}\nBody: ${JSON.stringify(body, null, 2)}\n\n`;
        fs.appendFileSync(path.join(process.cwd(), 'api-debug.log'), logData);

        console.log('API Received Body:', body);
        const { projectId, producto, codigo, idCategoria, idCategoriaRecetario, idPresentacion, precio, iva, archivoImagen, nombreArchivo, conversionSimple, idPresentacionConversion, pesoFinal, pesoInicial, idTipoProducto, idSeccionMenu, porcentajeCostoIdeal, cantidadCompra, idPresentacionInventario, unidadMedidaCompra, unidadMedidaInventario, unidadMedidaRecetario } = body;

        console.log('API Extracted Fields:', { cantidadCompra, idPresentacionInventario, unidadMedidaCompra, unidadMedidaInventario, unidadMedidaRecetario });

        // Validation: Required for all
        if (!projectId || !producto || !codigo || precio === undefined || iva === undefined || cantidadCompra === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        // Required only if NOT a Dish (type 1)
        if (idTipoProducto !== 1 && (!idCategoria || !idPresentacion)) {
            return NextResponse.json({ success: false, message: 'Category and Presentation are required' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        const sql = `UPDATE tblProductos SET Producto = ?, Codigo = ?, IdCategoria = ?, IdCategoriaRecetario = ?, IdPresentacion = ?, Precio = ?, IVA = ?, ArchivoImagen = ?, NombreArchivo = ?, ConversionSimple = ?, IdPresentacionConversion = ?, PesoFinal = ?, PesoInicial = ?, IdSeccionMenu = ?, PorcentajeCostoIdeal = ?, CantidadCompra = ?, IdPresentacionInventario = ?, UnidadMedidaCompra = ?, UnidadMedidaInventario = ?, UnidadMedidaRecetario = ?, FechaAct = Now() WHERE IdProducto = ?`;
        const params = [producto, codigo, idCategoria, idCategoriaRecetario /* Allow 0 */, idPresentacion, precio, iva, archivoImagen || null, nombreArchivo || null, conversionSimple || 0, idPresentacionConversion || null, pesoFinal || 0, pesoInicial || 0, idSeccionMenu || null, porcentajeCostoIdeal || null, cantidadCompra || 0, idPresentacionInventario || null, unidadMedidaCompra || null, unidadMedidaInventario || null, unidadMedidaRecetario || null, id];

        console.log('API executing SQL:', sql);
        console.log('API SQL Params:', params);

        const [result] = await connection.query(sql, params);

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
