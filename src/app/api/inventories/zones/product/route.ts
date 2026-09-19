import { NextRequest, NextResponse } from 'next/server';
import type { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';
import {
    asignarZonasAProducto,
    listarZonasDelProyecto,
    zonasDeProducto,
} from '@/lib/inventory-zones';

export const runtime = 'nodejs';

/**
 * Zonas de conteo de UN producto, visto desde el producto.
 *
 * La configuración por zona (qué insumos lleva la cámara fría) vive en
 * /api/inventories/zones. Esta ruta es el inverso: al dar de alta una materia
 * prima o una subreceta es más natural decir dónde vive ese insumo que ir
 * abriendo cada zona a buscarlo.
 *
 * Las zonas son POR SUCURSAL, así que vienen agrupadas: el mismo insumo puede
 * contarse en la cámara de una sucursal y en la barra de otra.
 */

export async function GET(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = Number(searchParams.get('projectId'));
        const productId = Number(searchParams.get('productId'));

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        const zonas = await listarZonasDelProyecto(connection);
        // Un producto nuevo (sin id) todavía no tiene asignaciones, pero sí
        // necesita saber qué zonas existen para poder ofrecerlas.
        const asignadas = new Set(
            Number.isInteger(productId) && productId > 0
                ? await zonasDeProducto(connection, productId)
                : []
        );

        // Agrupadas por sucursal, en el orden en que vienen (sucursal, recorrido).
        const porSucursal: {
            idSucursal: number;
            sucursal: string;
            zonas: { idZona: number; zona: string; asignada: boolean }[];
        }[] = [];

        for (const z of zonas) {
            let grupo = porSucursal.find(g => g.idSucursal === z.idSucursal);
            if (!grupo) {
                grupo = { idSucursal: z.idSucursal, sucursal: z.sucursal, zonas: [] };
                porSucursal.push(grupo);
            }
            grupo.zonas.push({ idZona: z.idZona, zona: z.zona, asignada: asignadas.has(z.idZona) });
        }

        return NextResponse.json({ success: true, sucursales: porSucursal, hayZonas: zonas.length > 0 });
    } catch (error) {
        console.error('Error loading product zones:', error);
        return NextResponse.json({ success: false, message: 'Error al cargar las áreas' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const body = await request.json();
        const projectId = Number(body.projectId);
        const productId = Number(body.productId);
        const zonas: number[] = Array.isArray(body.zonas) ? body.zonas.map(Number) : [];

        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }
        if (!Number.isInteger(productId) || productId <= 0) {
            return NextResponse.json({ success: false, message: 'Guarda el producto antes de asignarle áreas' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        const total = await asignarZonasAProducto(connection, productId, zonas);

        return NextResponse.json({ success: true, zonas: total });
    } catch (error) {
        console.error('Error saving product zones:', error);
        return NextResponse.json({ success: false, message: 'Error al guardar las áreas' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
