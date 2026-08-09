import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { resolveRequisitionUuid } from '@/lib/requisitions';

/**
 * Arranque de la página pública de requisiciones (tablet de cocina).
 *
 * ENDPOINT SIN AUTENTICACIÓN: la única credencial es el UUID de la URL.
 * Por eso devuelve el mínimo indispensable para armar el pedido — catálogo,
 * sucursales y tema visual — y NUNCA precios, costos ni datos de proveedores.
 */
export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const uuid = searchParams.get('uuid') || '';

        const project = await resolveRequisitionUuid(uuid);
        if (!project) {
            // Mismo mensaje para UUID mal formado, inexistente o revocado:
            // no le decimos a un curioso en cuál de los tres casos cayó.
            return NextResponse.json({ success: false, message: 'Liga no válida' }, { status: 404 });
        }

        connection = await getProjectConnection(project.idProyecto);

        const [branches] = await connection.query(
            'SELECT IdSucursal, Sucursal FROM tblSucursales WHERE Status = 0 ORDER BY Sucursal ASC'
        );

        // Insumos activos: es lo único que se puede requisitar.
        const [products] = await connection.query(
            `SELECT
                p.IdProducto,
                p.Producto,
                p.Codigo,
                p.IdCategoria,
                c.Categoria,
                COALESCE(NULLIF(p.UnidadMedidaInventario, ''), NULLIF(p.UnidadMedidaCompra, ''), 'PZA') AS Unidad
             FROM tblProductos p
             LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
             WHERE p.Status = 0 AND p.IdTipoProducto = 0
             ORDER BY c.Categoria ASC, p.Producto ASC`
        );

        // Perfiles con los que se puede firmar el pedido. Se manda si tienen
        // PIN, NUNCA el PIN: la verificación ocurre en el servidor.
        const [profiles] = await connection.query(
            `SELECT IdPerfil, IdSucursal, Perfil, (PinHash IS NOT NULL) AS TienePin
             FROM tblRequisicionPerfiles ORDER BY IdSucursal ASC, Orden ASC, Perfil ASC`
        );

        return NextResponse.json({
            success: true,
            profiles,
            project: {
                titulo: project.titulo || project.proyecto,
                logo64: project.logo64,
                colorFondo1: project.colorFondo1,
                colorFondo2: project.colorFondo2,
                colorLetra: project.colorLetra,
            },
            branches,
            products,
        });
    } catch (error) {
        console.error('Error loading requisition session:', error);
        return NextResponse.json({ success: false, message: 'Error al cargar el catálogo' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
