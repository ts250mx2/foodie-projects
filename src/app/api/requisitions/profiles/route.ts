import { NextRequest, NextResponse } from 'next/server';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { getProjectConnection } from '@/lib/dynamic-db';
import { MAX_PROFILE_NAME_LEN, PIN_PATTERN, sanitizeText } from '@/lib/requisitions';

/**
 * Administración de perfiles de requisición (Cocina, Barra, …) desde el portal.
 *
 * Nunca devuelve el PIN, ni siquiera hasheado: solo si el perfil tiene uno.
 * Un PIN olvidado se reemplaza, no se consulta.
 */

const errorDuplicado = (perfil: string | null) =>
    NextResponse.json(
        { success: false, message: perfil ? `Ya existe un perfil llamado "${perfil}"` : 'Ya existe un perfil con ese nombre' },
        { status: 409 }
    );

function isDuplicateKey(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ER_DUP_ENTRY';
}

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const idSucursal = searchParams.get('idSucursal');
        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        // Sin idSucursal devuelve todas: el portal las agrupa por sucursal.
        const [rows] = idSucursal
            ? await connection.query(
                `SELECT IdPerfil, IdSucursal, Perfil, (PinHash IS NOT NULL) AS TienePin
                 FROM tblRequisicionPerfiles WHERE IdSucursal = ? ORDER BY Orden ASC, Perfil ASC`,
                [idSucursal]
            )
            : await connection.query(
                `SELECT IdPerfil, IdSucursal, Perfil, (PinHash IS NOT NULL) AS TienePin
                 FROM tblRequisicionPerfiles ORDER BY IdSucursal ASC, Orden ASC, Perfil ASC`
            );

        return NextResponse.json({ success: true, data: rows as RowDataPacket[] });
    } catch (error) {
        console.error('Error listing requisition profiles:', error);
        return NextResponse.json({ success: false, message: 'Error al cargar los perfiles' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    // Fuera del try: el catch lo necesita para nombrar el duplicado.
    let nombre: string | null = null;
    try {
        const { projectId, idSucursal, perfil, pin } = await request.json();
        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }
        if (!idSucursal) {
            return NextResponse.json({ success: false, message: 'Selecciona la sucursal del perfil' }, { status: 400 });
        }

        nombre = sanitizeText(perfil, MAX_PROFILE_NAME_LEN);
        if (!nombre) {
            return NextResponse.json({ success: false, message: 'Escribe el nombre del perfil' }, { status: 400 });
        }
        if (pin != null && pin !== '' && !PIN_PATTERN.test(String(pin))) {
            return NextResponse.json({ success: false, message: 'El PIN debe ser de 4 a 8 dígitos' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        const pinHash = pin ? await bcrypt.hash(String(pin), 10) : null;
        const [orden] = await connection.query(
            'SELECT COALESCE(MAX(Orden), 0) + 1 AS Siguiente FROM tblRequisicionPerfiles WHERE IdSucursal = ?',
            [idSucursal]
        );

        const [result] = await connection.query(
            'INSERT INTO tblRequisicionPerfiles (IdSucursal, Perfil, PinHash, Orden, FechaAct) VALUES (?, ?, ?, ?, Now())',
            [idSucursal, nombre, pinHash, (orden as RowDataPacket[])[0].Siguiente]
        );

        return NextResponse.json({ success: true, idPerfil: (result as ResultSetHeader).insertId });
    } catch (error) {
        if (isDuplicateKey(error)) return errorDuplicado(nombre);
        console.error('Error creating requisition profile:', error);
        return NextResponse.json({ success: false, message: 'Error al crear el perfil' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

/** Renombra el perfil y/o cambia su PIN. `pin: null` lo quita. */
export async function PATCH(request: NextRequest) {
    let connection;
    // Fuera del try: el catch lo necesita para nombrar el duplicado.
    let nombre: string | null = null;
    try {
        const body = await request.json();
        const { projectId, idPerfil, perfil, pin } = body;

        if (!projectId || !idPerfil) {
            return NextResponse.json({ success: false, message: 'Faltan datos del perfil' }, { status: 400 });
        }

        const cambiaNombre = perfil !== undefined;
        const cambiaPin = Object.prototype.hasOwnProperty.call(body, 'pin');
        if (!cambiaNombre && !cambiaPin) {
            return NextResponse.json({ success: false, message: 'Nada que actualizar' }, { status: 400 });
        }

        if (cambiaNombre) {
            nombre = sanitizeText(perfil, MAX_PROFILE_NAME_LEN);
            if (!nombre) {
                return NextResponse.json({ success: false, message: 'Escribe el nombre del perfil' }, { status: 400 });
            }
        }

        // pin === null quita el PIN; una cadena lo reemplaza.
        let pinHash: string | null = null;
        if (cambiaPin && pin !== null && pin !== '') {
            if (!PIN_PATTERN.test(String(pin))) {
                return NextResponse.json({ success: false, message: 'El PIN debe ser de 4 a 8 dígitos' }, { status: 400 });
            }
            pinHash = await bcrypt.hash(String(pin), 10);
        }

        connection = await getProjectConnection(parseInt(projectId));

        const sets: string[] = [];
        const values: unknown[] = [];
        if (cambiaNombre) { sets.push('Perfil = ?'); values.push(nombre); }
        if (cambiaPin) { sets.push('PinHash = ?'); values.push(pinHash); }
        sets.push('FechaAct = Now()');
        values.push(idPerfil);

        await connection.query(`UPDATE tblRequisicionPerfiles SET ${sets.join(', ')} WHERE IdPerfil = ?`, values);

        return NextResponse.json({ success: true });
    } catch (error) {
        if (isDuplicateKey(error)) return errorDuplicado(nombre);
        console.error('Error updating requisition profile:', error);
        return NextResponse.json({ success: false, message: 'Error al actualizar el perfil' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const idPerfil = searchParams.get('idPerfil');

        if (!projectId || !idPerfil) {
            return NextResponse.json({ success: false, message: 'Faltan datos del perfil' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));
        // Borrado real: las requisiciones guardan el área como texto, así que
        // eliminar el perfil no deja histórico huérfano.
        await connection.query('DELETE FROM tblRequisicionPerfiles WHERE IdPerfil = ?', [idPerfil]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting requisition profile:', error);
        return NextResponse.json({ success: false, message: 'Error al eliminar el perfil' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
