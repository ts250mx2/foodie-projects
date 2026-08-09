import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { getProjectConnection } from '@/lib/dynamic-db';
import { resolveRequisitionUuid } from '@/lib/requisitions';

/**
 * Comprueba el PIN de un perfil desde la tablet.
 *
 * ENDPOINT SIN AUTENTICACIÓN (la credencial es el UUID). Existe solo para la
 * experiencia de captura: la validación que de verdad cuenta vuelve a hacerse
 * al crear la requisición, así que saltarse esta pantalla no sirve de nada.
 */
export async function POST(request: NextRequest) {
    let connection;
    try {
        const { uuid, idPerfil, pin } = await request.json();

        const project = await resolveRequisitionUuid(typeof uuid === 'string' ? uuid : '');
        if (!project) {
            return NextResponse.json({ success: false, message: 'Liga no válida' }, { status: 404 });
        }

        connection = await getProjectConnection(project.idProyecto);
        const [rows] = await connection.query(
            'SELECT PinHash FROM tblRequisicionPerfiles WHERE IdPerfil = ?',
            [idPerfil]
        );
        const profile = (rows as RowDataPacket[])[0];
        if (!profile) {
            return NextResponse.json({ success: false, message: 'Perfil no encontrado' }, { status: 404 });
        }

        // Sin PIN configurado: pasa cualquiera.
        if (!profile.PinHash) return NextResponse.json({ success: true });

        const ok = typeof pin === 'string' && await bcrypt.compare(pin, profile.PinHash);
        if (!ok) {
            return NextResponse.json({ success: false, message: 'PIN incorrecto' }, { status: 401 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error verifying requisition PIN:', error);
        return NextResponse.json({ success: false, message: 'Error al verificar el PIN' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
