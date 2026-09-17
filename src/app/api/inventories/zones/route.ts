import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';
import {
    asignarProductos,
    crearZona,
    listarZonas,
    productosDeZona,
    sanitizeZona,
} from '@/lib/inventory-zones';

export const runtime = 'nodejs';

/**
 * Zonas de conteo de una sucursal y los productos que se cuentan en cada una.
 *
 * GET    → zonas de la sucursal, con cuántos insumos tiene asignados cada una;
 *          con `zoneId` devuelve los ids asignados a esa zona.
 * POST   → crea una zona al final del recorrido.
 * PUT    → renombra, reordena o reemplaza los productos asignados.
 * DELETE → baja lógica. El conteo histórico NO se borra: los inventarios ya
 *          levantados con esa zona siguen cuadrando con su total.
 */

export async function GET(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = Number(searchParams.get('projectId'));
        const branchId = Number(searchParams.get('branchId'));
        const zoneId = Number(searchParams.get('zoneId'));

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        if (Number.isInteger(zoneId) && zoneId > 0) {
            return NextResponse.json({ success: true, productos: await productosDeZona(connection, zoneId) });
        }

        if (!Number.isInteger(branchId) || branchId <= 0) {
            return NextResponse.json({ success: false, message: 'Branch ID is required' }, { status: 400 });
        }

        const zonas = await listarZonas(connection, branchId);

        // Cuántos insumos tiene cada zona: es lo que la pantalla necesita para
        // avisar que una zona quedó vacía (y por lo tanto mostraría todo).
        const [conteos] = await connection.query<RowDataPacket[]>(
            `SELECT zp.IdZona, COUNT(*) AS Productos
               FROM tblZonasProductos zp
               INNER JOIN tblZonas z ON z.IdZona = zp.IdZona
              WHERE z.IdSucursal = ?
              GROUP BY zp.IdZona`,
            [branchId]
        );
        const porZona = new Map(conteos.map(c => [Number(c.IdZona), Number(c.Productos)]));

        return NextResponse.json({
            success: true,
            zonas: zonas.map(z => ({ ...z, productos: porZona.get(z.idZona) || 0 })),
        });
    } catch (error) {
        console.error('Error listing inventory zones:', error);
        return NextResponse.json({ success: false, message: 'Error al cargar las zonas' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const body = await request.json();
        const projectId = Number(body.projectId);
        const branchId = Number(body.branchId);
        const zona = sanitizeZona(body.zona);

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }
        if (!Number.isInteger(branchId) || branchId <= 0) {
            return NextResponse.json({ success: false, message: 'Branch ID is required' }, { status: 400 });
        }
        if (!zona) {
            return NextResponse.json({ success: false, message: 'La zona necesita nombre' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        const idZona = await crearZona(connection, branchId, zona);

        return NextResponse.json({ success: true, idZona });
    } catch (error) {
        console.error('Error creating inventory zone:', error);
        return NextResponse.json({ success: false, message: 'Error al crear la zona' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const body = await request.json();
        const projectId = Number(body.projectId);
        const idZona = Number(body.idZona);

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }
        if (!Number.isInteger(idZona) || idZona <= 0) {
            return NextResponse.json({ success: false, message: 'Zona no válida' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        if (body.zona !== undefined) {
            const zona = sanitizeZona(body.zona);
            if (!zona) {
                return NextResponse.json({ success: false, message: 'La zona necesita nombre' }, { status: 400 });
            }
            await connection.query(
                'UPDATE tblZonas SET Zona = ?, FechaAct = NOW() WHERE IdZona = ?',
                [zona, idZona]
            );
        }

        if (body.orden !== undefined) {
            await connection.query(
                'UPDATE tblZonas SET Orden = ?, FechaAct = NOW() WHERE IdZona = ?',
                [Number(body.orden) || 0, idZona]
            );
        }

        if (Array.isArray(body.productos)) {
            await asignarProductos(connection, idZona, body.productos.map(Number));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating inventory zone:', error);
        return NextResponse.json({ success: false, message: 'Error al guardar la zona' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = Number(searchParams.get('projectId'));
        const idZona = Number(searchParams.get('zoneId'));

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }
        if (!Number.isInteger(idZona) || idZona <= 0) {
            return NextResponse.json({ success: false, message: 'Zona no válida' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Baja lógica: los conteos históricos de esa zona se quedan, porque son
        // el respaldo de totales de inventarios ya cerrados.
        await connection.query('UPDATE tblZonas SET Status = 2, FechaAct = NOW() WHERE IdZona = ?', [idZona]);
        await connection.query('DELETE FROM tblZonasProductos WHERE IdZona = ?', [idZona]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting inventory zone:', error);
        return NextResponse.json({ success: false, message: 'Error al eliminar la zona' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
