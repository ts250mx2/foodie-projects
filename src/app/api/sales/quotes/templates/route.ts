import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export const runtime = 'nodejs';

/**
 * Plantillas de cotización (tblCotizacionesPlantillas): guardan conceptos,
 * gastos y notas como JSON para reutilizarlos al crear cotizaciones nuevas.
 */

// GET /api/sales/quotes/templates?projectId — lista de plantillas (con sus datos).
export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));
        const [rows] = await connection.query(
            'SELECT IdPlantilla, Nombre, Datos FROM tblCotizacionesPlantillas ORDER BY Nombre ASC'
        );
        const data = (rows as RowDataPacket[]).map((r) => {
            let datos = null;
            try { datos = r.Datos ? JSON.parse(r.Datos) : null; } catch { /* JSON corrupto */ }
            return { IdPlantilla: r.IdPlantilla, Nombre: r.Nombre, datos };
        });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching quote templates:', error);
        return NextResponse.json({ success: false, message: 'Error fetching templates' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

// POST — crea una plantilla: { projectId, nombre, datos: { platillos, gastos, notas } }.
export async function POST(request: NextRequest) {
    let connection;
    try {
        const { projectId, nombre, datos } = await request.json();
        if (!projectId || !nombre || !datos) {
            return NextResponse.json({ success: false, message: 'Faltan campos (projectId, nombre, datos).' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));
        const [result]: any = await connection.query(
            'INSERT INTO tblCotizacionesPlantillas (Nombre, Datos, FechaAct) VALUES (?, ?, Now())',
            [String(nombre).trim(), JSON.stringify(datos)]
        );
        return NextResponse.json({ success: true, id: result.insertId, message: 'Plantilla guardada' });
    } catch (error) {
        console.error('Error creating quote template:', error);
        return NextResponse.json({ success: false, message: 'Error creating template' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

// PUT — actualiza una plantilla existente: { projectId, id, nombre, datos }.
export async function PUT(request: NextRequest) {
    let connection;
    try {
        const { projectId, id, nombre, datos } = await request.json();
        if (!projectId || !id || !nombre || !datos) {
            return NextResponse.json({ success: false, message: 'Faltan campos (projectId, id, nombre, datos).' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));
        await connection.query(
            'UPDATE tblCotizacionesPlantillas SET Nombre = ?, Datos = ?, FechaAct = Now() WHERE IdPlantilla = ?',
            [String(nombre).trim(), JSON.stringify(datos), parseInt(id)]
        );
        return NextResponse.json({ success: true, message: 'Plantilla actualizada' });
    } catch (error) {
        console.error('Error updating quote template:', error);
        return NextResponse.json({ success: false, message: 'Error updating template' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

// DELETE /api/sales/quotes/templates?projectId=&id= — elimina una plantilla.
export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const idStr = searchParams.get('id');
        if (!projectIdStr || !idStr) {
            return NextResponse.json({ success: false, message: 'Missing projectId or id' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));
        await connection.query('DELETE FROM tblCotizacionesPlantillas WHERE IdPlantilla = ?', [parseInt(idStr)]);
        return NextResponse.json({ success: true, message: 'Plantilla eliminada' });
    } catch (error) {
        console.error('Error deleting quote template:', error);
        return NextResponse.json({ success: false, message: 'Error deleting template' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
