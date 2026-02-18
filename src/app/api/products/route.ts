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
            query = `SELECT * FROM vlProductos WHERE Status = 0 ORDER BY Producto`;
        } else if (tipoProductoStr === '2') {
            query = `
                SELECT 
                    IdProducto,
                    Producto,
                    Codigo,
                    Categoria,
                    Presentacion,
                    COALESCE(Costo, 0) as Costo,
                    Status,
                    ArchivoImagen,
                    NombreArchivo,
                    IdTipoProducto,
                    IdCategoria,
                    IdPresentacion,
                    COALESCE(Precio, 0) as Precio,
                    COALESCE(IVA, 0) as IVA,
                    PesoInicial,
                    PesoFinal,
                    ConversionSimple,
                    IdCategoriaRecetario,
                    IdPresentacionConversion,
                    IdSeccionMenu,
                    PorcentajeCostoIdeal,
                    CantidadCompra,
                    IdPresentacionInventario,
                    UnidadMedidaCompra,
                    UnidadMedidaInventario,
                    UnidadMedidaRecetario
                FROM vlProductos 
                WHERE Status = 0 AND IdTipoProducto = 2
            `;
        } else {
            query = `
                SELECT 
                    p.IdProducto,
                    p.Producto,
                    p.Codigo,
                    p.IdCategoria,
                    p.IdPresentacion,
                    p.Precio,
                    p.IVA,
                    p.IdTipoProducto,
                    p.ArchivoImagen,
                    p.NombreArchivo,
                    p.Status,
                    p.PesoInicial,
                    p.PesoFinal,
                    p.ConversionSimple,
                    p.IdCategoriaRecetario,
                    p.IdPresentacionConversion,
                    p.IdSeccionMenu,
                    p.PorcentajeCostoIdeal,
                    p.CantidadCompra,
                    p.IdPresentacionInventario,
                    p.UnidadMedidaCompra,
                    p.UnidadMedidaInventario,
                    p.UnidadMedidaRecetario,
                    c.Categoria,
                    pr.Presentacion,
                    cr.CategoriaRecetario,
                    pc.Presentacion AS PresentacionConversion,
                    pi.Presentacion AS PresentacionInventario,
                    COALESCE(v.Costo, vp.Costo) as Costo
                FROM tblProductos p
                LEFT JOIN vlProductos v ON p.IdProducto = v.IdProducto
                LEFT JOIN vlPlatillos vp ON p.IdProducto = vp.IdProducto
                LEFT JOIN tblCategorias c ON p.IdCategoria = c.IdCategoria
                LEFT JOIN tblPresentaciones pr ON p.IdPresentacion = pr.IdPresentacion
                LEFT JOIN tblCategoriasRecetario cr ON p.IdCategoriaRecetario = cr.IdCategoriaRecetario
                LEFT JOIN tblPresentaciones pc ON p.IdPresentacionConversion = pc.IdPresentacion
                LEFT JOIN tblPresentaciones pi ON p.IdPresentacionInventario = pi.IdPresentacion
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
        const { projectId, producto, codigo, idCategoria, idPresentacion, precio, iva, idTipoProducto, archivoImagen, nombreArchivo, idSeccionMenu, porcentajeCostoIdeal, idCategoriaRecetario, cantidadCompra, idPresentacionInventario, unidadMedidaCompra, unidadMedidaInventario, unidadMedidaRecetario } = body;

        // Validation: Required for all
        if (!projectId || !producto || !codigo || precio === undefined || iva === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        // Required only if NOT a Dish (type 1)
        if (idTipoProducto !== 1 && (!idCategoria || !idPresentacion)) {
            return NextResponse.json({ success: false, message: 'Category and Presentation are required' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Check for duplicate product name
        const [existingProductByName] = await connection.query(
            'SELECT IdProducto FROM tblProductos WHERE Producto = ? AND Status = 0',
            [producto]
        );

        if (existingProductByName.length > 0) {
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
            return NextResponse.json({
                success: false,
                error: 'El código ya existe'
            }, { status: 400 });
        }

        // Status = 0 (Active), FechaAct = Now()
        const [result] = await connection.query(
            `INSERT INTO tblProductos (Producto, Codigo, IdCategoria, IdPresentacion, Precio, IVA, IdTipoProducto, ArchivoImagen, NombreArchivo, Status, IdSeccionMenu, PorcentajeCostoIdeal, IdCategoriaRecetario, CantidadCompra, IdPresentacionInventario, UnidadMedidaCompra, UnidadMedidaInventario, UnidadMedidaRecetario, FechaAct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, Now())`,
            [producto, codigo, idCategoria || null, idPresentacion || null, precio, iva, idTipoProducto || 0, archivoImagen || null, nombreArchivo || null, idSeccionMenu || null, porcentajeCostoIdeal || null, idCategoriaRecetario || null, cantidadCompra || 0, idPresentacionInventario || null, unidadMedidaCompra || null, unidadMedidaInventario || null, unidadMedidaRecetario || null]
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

