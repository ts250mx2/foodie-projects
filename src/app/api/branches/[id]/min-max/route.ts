import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(
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

        // Ensure table exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblSucursalesMaximosMinimos\` (
                \`IdSucursal\` int NOT NULL,
                \`IdProducto\` int NOT NULL,
                \`Minimo\` double DEFAULT 0,
                \`Maximo\` double DEFAULT 0,
                \`FechaAct\` datetime DEFAULT NULL,
                PRIMARY KEY (\`IdSucursal\`,\`IdProducto\`)
            ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
        `);

        // Fetch all active products and join with Min/Max settings for this branch
        const [rows] = await connection.query(
            `SELECT 
                p.IdProducto, p.Producto, p.Codigo, 
                v.UnidadMedidaInventario AS Presentacion, 
                v.IdCategoria, v.Categoria, v.ImagenCategoria, v.ArchivoImagen,
                m.Minimo, m.Maximo, m.FechaAct
             FROM tblProductos p
             LEFT JOIN vlProductos v ON p.IdProducto = v.IdProducto
             LEFT JOIN tblSucursalesMaximosMinimos m ON p.IdProducto = m.IdProducto AND m.IdSucursal = ?
             WHERE p.Status = 0
             ORDER BY v.Categoria, p.Producto`,
            [id]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching branch min-max settings:', error);
        return NextResponse.json({ success: false, message: 'Error fetching branch min-max settings' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, updates } = body;

        if (!projectId || !Array.isArray(updates)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Ensure table exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblSucursalesMaximosMinimos\` (
                \`IdSucursal\` int NOT NULL,
                \`IdProducto\` int NOT NULL,
                \`Minimo\` double DEFAULT 0,
                \`Maximo\` double DEFAULT 0,
                \`FechaAct\` datetime DEFAULT NULL,
                PRIMARY KEY (\`IdSucursal\`,\`IdProducto\`)
            ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
        `);

        // Perform batch update/replace
        for (const update of updates) {
            const { productId, min, max } = update;
            await connection.query(
                `REPLACE INTO tblSucursalesMaximosMinimos (IdSucursal, IdProducto, Minimo, Maximo, FechaAct) 
                 VALUES (?, ?, ?, ?, Now())`,
                [id, productId, min ?? 0, max ?? 0]
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Min/Max settings saved successfully'
        });
    } catch (error) {
        console.error('Error saving branch min-max settings:', error);
        return NextResponse.json({ success: false, message: 'Error saving branch min-max settings' }, { status: 500 });
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
        const productIdStr = searchParams.get('productId');

        if (!projectIdStr || !productIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const productId = parseInt(productIdStr);

        connection = await getProjectConnection(projectId);

        await connection.query(
            'DELETE FROM tblSucursalesMaximosMinimos WHERE IdSucursal = ? AND IdProducto = ?',
            [id, productId]
        );

        return NextResponse.json({
            success: true,
            message: 'Min/Max setting deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting branch min-max setting:', error);
        return NextResponse.json({ success: false, message: 'Error deleting branch min-max setting' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
