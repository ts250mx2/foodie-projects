import { NextRequest, NextResponse } from 'next/server';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { getProjectConnection } from '@/lib/dynamic-db';
import { sanitizeSurveyText, MAX_ATTENDANT_NAME_LEN, MAX_ATTENDANTS } from '@/lib/surveys';

/**
 * Lista de personas que pueden haber atendido al comensal (portal autenticado).
 *
 * Es la opción "predefinida" del bloque "¿Quién te atendió?": el comensal la
 * elige de aquí en lugar de escribir el nombre. La lectura también viaja en
 * GET /api/surveys/questions para que el configurador cargue de una sola vez;
 * esta ruta existe para las altas, cambios y bajas.
 *
 * Baja lógica (Activo = 0) en lugar de borrado: las respuestas guardan el
 * nombre como snapshot, pero el IdAtendio sigue apuntando aquí y el reporte
 * agrupa por persona.
 */

async function loadAttendants(connection: Connection) {
    const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT IdAtendio, Nombre, Orden, Activo
         FROM tblEncuestasAtendieron
         ORDER BY Orden ASC, Nombre ASC`
    );
    return rows;
}

export async function GET(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const projectId = Number(new URL(request.url).searchParams.get('projectId'));
        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        return NextResponse.json({ success: true, attendants: await loadAttendants(connection) });
    } catch (error) {
        console.error('Error listing survey attendants:', error);
        return NextResponse.json({ success: false, message: 'Error al cargar la lista' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { projectId, nombre } = await request.json();
        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const limpio = sanitizeSurveyText(nombre, MAX_ATTENDANT_NAME_LEN);
        if (!limpio) {
            return NextResponse.json({ success: false, message: 'Escribe el nombre de la persona' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        const [countRows] = await connection.query<RowDataPacket[]>(
            'SELECT COUNT(*) AS Total, COALESCE(MAX(Orden), 0) + 1 AS Siguiente FROM tblEncuestasAtendieron'
        );
        if (Number(countRows[0]?.Total) >= MAX_ATTENDANTS) {
            return NextResponse.json(
                { success: false, message: `La lista no puede tener más de ${MAX_ATTENDANTS} personas` },
                { status: 400 }
            );
        }

        // Repetir el mismo nombre solo confunde al comensal, que vería dos
        // botones idénticos sin manera de distinguirlos.
        const [dup] = await connection.query<RowDataPacket[]>(
            'SELECT IdAtendio FROM tblEncuestasAtendieron WHERE Nombre = ? LIMIT 1',
            [limpio]
        );
        if (dup.length > 0) {
            return NextResponse.json({ success: false, message: `"${limpio}" ya está en la lista` }, { status: 409 });
        }

        const [result] = await connection.query<ResultSetHeader>(
            'INSERT INTO tblEncuestasAtendieron (Nombre, Orden, Activo, FechaAct) VALUES (?, ?, 1, Now())',
            [limpio, countRows[0]?.Siguiente ?? 0]
        );

        return NextResponse.json({ success: true, idAtendio: result.insertId });
    } catch (error) {
        console.error('Error creating survey attendant:', error);
        return NextResponse.json({ success: false, message: 'Error al agregar la persona' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

/** Renombra y/o activa-desactiva. */
export async function PUT(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const body = await request.json();
        const { projectId, idAtendio, nombre } = body;
        if (!projectId || !idAtendio) {
            return NextResponse.json({ success: false, message: 'Faltan datos de la persona' }, { status: 400 });
        }

        const cambiaNombre = nombre !== undefined;
        const cambiaActivo = Object.prototype.hasOwnProperty.call(body, 'activo');
        if (!cambiaNombre && !cambiaActivo) {
            return NextResponse.json({ success: false, message: 'Nada que actualizar' }, { status: 400 });
        }

        let limpio: string | null = null;
        if (cambiaNombre) {
            limpio = sanitizeSurveyText(nombre, MAX_ATTENDANT_NAME_LEN);
            if (!limpio) {
                return NextResponse.json({ success: false, message: 'Escribe el nombre de la persona' }, { status: 400 });
            }
        }

        connection = await getProjectConnection(parseInt(projectId));

        if (limpio) {
            const [dup] = await connection.query<RowDataPacket[]>(
                'SELECT IdAtendio FROM tblEncuestasAtendieron WHERE Nombre = ? AND IdAtendio <> ? LIMIT 1',
                [limpio, idAtendio]
            );
            if (dup.length > 0) {
                return NextResponse.json({ success: false, message: `"${limpio}" ya está en la lista` }, { status: 409 });
            }
        }

        const sets: string[] = [];
        const values: unknown[] = [];
        if (cambiaNombre) { sets.push('Nombre = ?'); values.push(limpio); }
        if (cambiaActivo) { sets.push('Activo = ?'); values.push(body.activo ? 1 : 0); }
        sets.push('FechaAct = Now()');
        values.push(idAtendio);

        await connection.query(`UPDATE tblEncuestasAtendieron SET ${sets.join(', ')} WHERE IdAtendio = ?`, values);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating survey attendant:', error);
        return NextResponse.json({ success: false, message: 'Error al actualizar la persona' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = Number(searchParams.get('projectId'));
        const idAtendio = Number(searchParams.get('idAtendio'));
        if (!Number.isInteger(projectId) || !Number.isInteger(idAtendio)) {
            return NextResponse.json({ success: false, message: 'Faltan datos de la persona' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        // Las respuestas guardan el nombre como texto, así que borrar a la
        // persona no deja huecos en el reporte histórico.
        await connection.query('DELETE FROM tblEncuestasAtendieron WHERE IdAtendio = ?', [idAtendio]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting survey attendant:', error);
        return NextResponse.json({ success: false, message: 'Error al eliminar la persona' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
