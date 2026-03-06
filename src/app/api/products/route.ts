import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const tipoProductoStr = searchParams.get('tipoProducto');
        const useView = searchParams.get('useView') === 'true';

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        let query = '';
        const params: any[] = [];

        if (useView) {
            query = `
                SELECT 
                    v.*,
                    c.ImagenCategoria,
                    c.IdModuloRecetario
                FROM vlProductos v
                LEFT JOIN BDFoodieProjects.tblCategorias c ON v.IdCategoria = c.IdCategoria
                WHERE v.Status = 0 
                ORDER BY v.Producto
            `;
        } else if (tipoProductoStr === '2') {
            query = `
                SELECT 
                    v.*,
                    c.ImagenCategoria,
                    c.IdModuloRecetario
                FROM vlProductos v
                LEFT JOIN BDFoodieProjects.tblCategorias c ON v.IdCategoria = c.IdCategoria
                WHERE v.Status = 0 AND v.IdTipoProducto = 2
            `;
        } else {
            query = `
                SELECT 
                    p.IdProducto,
                    p.Producto,
                    p.Codigo,
                    p.IdCategoria,
                    p.Precio,
                    p.IVA,
                    p.IdTipoProducto,
                    p.ArchivoImagen,
                    p.NombreArchivo,
                    p.Status,
                    p.PesoInicial,
                    p.PesoFinal,
                    p.ConversionSimple,
                    c.IdModuloRecetario,
                    p.IdSeccionMenu,
                    p.PorcentajeCostoIdeal,
                    p.CantidadCompra,
                    p.UnidadMedidaCompra,
                    p.UnidadMedidaInventario,
                    p.UnidadMedidaRecetario,
                    c.Categoria,
                    c.ImagenCategoria,
                    COALESCE(v.Costo, vp.Costo) as Costo
                FROM tblProductos p
                LEFT JOIN vlProductos v ON p.IdProducto = v.IdProducto
                LEFT JOIN vlPlatillos vp ON p.IdProducto = vp.IdProducto
                LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
                WHERE p.Status = 0
            `;

            if (tipoProductoStr !== null) {
                if (tipoProductoStr.includes(',')) {
                    const types = tipoProductoStr.split(',').map(t => parseInt(t.trim())).filter(n => !isNaN(n));
                    if (types.length > 0) {
                        query += ` AND p.IdTipoProducto IN (${types.map(() => '?').join(',')})`;
                        params.push(...types);
                    }
                } else {
                    query += ' AND p.IdTipoProducto = ?';
                    params.push(parseInt(tipoProductoStr));
                }
            }
        }

        //query += ' ORDER BY Producto ASC';

        const [rows] = await connection.query(query, params);


        // Convert ArchivoImagen Buffer to string if necessary
        const formattedRows = (rows as any[]).map(row => ({
            ...row,
            ArchivoImagen: row.ArchivoImagen ? row.ArchivoImagen.toString() : null
        }));

        return NextResponse.json({ success: true, data: formattedRows });
    } catch (error) {
        console.error('Error fetching products:', error);
        return NextResponse.json({ success: false, message: 'Error fetching products' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, producto, codigo, idCategoria, precio, iva, idTipoProducto, archivoImagen, nombreArchivo, idSeccionMenu, porcentajeCostoIdeal, cantidadCompra, unidadMedidaCompra, unidadMedidaInventario, unidadMedidaRecetario } = body;

        // Validation: Required for all
        if (!projectId || !producto || !codigo || precio === undefined || iva === undefined) {
            console.error('Error creating product:', 'Missing required fields');

            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        // Required only if NOT a Dish (type 1)
        if (idTipoProducto !== 1 && (!idCategoria)) {

            console.error('Error creating product:', 'Category and Presentation are required');

            return NextResponse.json({ success: false, message: 'Category and Presentation are required' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Check for duplicate product name
        const [existingProductByName] = await connection.query(
            'SELECT IdProducto FROM tblProductos WHERE Producto = ? AND Status = 0',
            [producto]
        );

        if (existingProductByName.length > 0) {

            console.error('Error creating product:', 'El producto ya existe');

            return NextResponse.json({
                success: false,
                error: 'El producto ya existe'
            }, { status: 400 });
        }

        // Check for duplicate product code
        const [existingProductByCode] = await connection.query(
            'SELECT IdProducto FROM tblProductos WHERE Codigo = ? AND Status = 0',
            [codigo]
        );

        if (existingProductByCode.length > 0) {

            console.error('Error creating product:', 'El código ya existe');


            return NextResponse.json({
                success: false,
                error: 'El código ya existe'
            }, { status: 400 });
        }

        // Status = 0 (Active), FechaAct = Now()

        const [result] = await connection.query(
            `INSERT INTO tblProductos (Producto, Codigo, IdCategoria, Precio, IVA, IdTipoProducto, ArchivoImagen, NombreArchivo, Status, IdSeccionMenu, PorcentajeCostoIdeal, CantidadCompra, UnidadMedidaCompra, UnidadMedidaInventario, UnidadMedidaRecetario, FechaAct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, Now())`,
            [producto, codigo, idCategoria || null, precio, iva, idTipoProducto || 0, archivoImagen || null, nombreArchivo || null, idSeccionMenu || null, porcentajeCostoIdeal || null, cantidadCompra || 0, unidadMedidaCompra || null, unidadMedidaInventario || null, unidadMedidaRecetario || null]
        );

        return NextResponse.json({
            success: true,
            message: 'Product created successfully',
            id: result.insertId // Fixed key to match expected frontend prop (data.id)
        });
    } catch (error) {
        console.error('Error creating product:', error);
        return NextResponse.json({ success: false, message: 'Error creating product' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

