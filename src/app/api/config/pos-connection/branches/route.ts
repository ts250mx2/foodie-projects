import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

export const runtime = 'nodejs';

/**
 * Lista las sucursales conocidas de Wansoft (Id + nombre) a partir de los datos
 * ya importados en tblWansoftVentasSucursal. Sirve para el selector del botón
 * "Importar información". Si aún no se ha importado nada, devuelve lista vacía.
 */
export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        let rows: any[] = [];
        try {
            const [result]: any = await connection.query(
                `SELECT IdSucursal, MAX(Sucursal) AS Sucursal
                 FROM tblWansoftVentasSucursal
                 GROUP BY IdSucursal
                 ORDER BY Sucursal`
            );
            rows = result;
        } catch {
            // La tabla aún no existe (nunca se ha importado): lista vacía.
            rows = [];
        }

        return NextResponse.json({ success: true, data: rows });
    } catch (error: any) {
        console.error('Error fetching Wansoft branches:', error);
        return NextResponse.json({ success: false, message: 'Error fetching branches' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
