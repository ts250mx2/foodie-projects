import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const tipoProductoStr = searchParams.get('tipoProducto');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        let query = `SELECT 
                p.IdProducto,
                p.Producto,
                p.Codigo,
                p.IdCategoria,
                p.IdPresentacion,
                p.Precio,
                p.IVA,
                p.RutaFoto,
                p.Status,
                p.PesoInicial,
                p.PesoFinal,
                p.ConversionSimple,
                p.IdCategoriaRecetario,
                p.IdPresentacionConversion,
                c.Categoria,
                pr.Presentacion,
                cr.CategoriaRecetario,
                pc.Presentacion AS PresentacionConversion
            FROM tblProductos p
            LEFT JOIN tblCategorias c ON p.IdCategoria = c.IdCategoria
            LEFT JOIN tblPresentaciones pr ON p.IdPresentacion = pr.IdPresentacion
            LEFT JOIN tblCategoriasRecetario cr ON p.IdCategoriaRecetario = cr.IdCategoriaRecetario
            LEFT JOIN tblPresentaciones pc ON p.IdPresentacionConversion = pc.IdPresentacion
            WHERE p.Status = 0`;

        const params: any[] = [];

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

        query += ' ORDER BY p.Producto ASC';

        const [rows] = (await connection.query(query, params);

        return NextResponse.json({ success: true, data: rows });
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
        const { projectId, producto, codigo, idCategoria, idPresentacion, precio, iva, idTipoProducto, rutaFoto } = body;

        if (!projectId || !producto || !codigo || !idCategoria || !idPresentacion || precio === undefined || iva === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
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
        const [result] = (await connection.query(
            `INSERT INTO tblProductos (Producto, Codigo, IdCategoria, IdPresentacion, Precio, IVA, IdTipoProducto, RutaFoto, Status, FechaAct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, Now())`,
            [producto, codigo, idCategoria, idPresentacion, precio, iva, idTipoProducto || 0, rutaFoto || null]
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

