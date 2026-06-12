import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * CRUD de teléfonos con acceso por WhatsApp de un proyecto.
 * Tabla: BDFoodieProjects.tblProyectosTelefonos (BD maestra, vía pool).
 * Esquema real: (IdProyecto, Telefono). IdProyecto = proyecto actual;
 * Telefono = número capturado.
 */

const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');

export async function GET(req: Request) {
    try {
        const projectId = Number(new URL(req.url).searchParams.get('projectId'));
        if (!projectId) return NextResponse.json({ success: false, message: 'projectId requerido', phones: [] }, { status: 400 });
        const [rows]: any = await pool.query(
            'SELECT Telefono FROM tblProyectosTelefonos WHERE IdProyecto = ? ORDER BY Telefono', [projectId]
        );
        return NextResponse.json({ success: true, phones: rows.map((r: any) => r.Telefono) });
    } catch (e: any) {
        console.error('whatsapp-phones GET error:', e);
        return NextResponse.json({ success: false, message: e?.message || 'Error', phones: [] }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { projectId, telefono } = await req.json();
        if (!projectId || !telefono) return NextResponse.json({ success: false, message: 'projectId y telefono requeridos' }, { status: 400 });
        const clean = String(telefono).trim();
        if (onlyDigits(clean).length < 8) return NextResponse.json({ success: false, message: 'Teléfono inválido' }, { status: 400 });

        // Evita duplicados (mismo proyecto, mismo número)
        const [exist]: any = await pool.query(
            'SELECT 1 FROM tblProyectosTelefonos WHERE IdProyecto = ? AND Telefono = ? LIMIT 1', [projectId, clean]
        );
        if (exist.length) return NextResponse.json({ success: false, message: 'Ese teléfono ya está registrado' }, { status: 409 });

        await pool.query(
            'INSERT INTO tblProyectosTelefonos (IdProyecto, Telefono) VALUES (?, ?)', [projectId, clean]
        );
        return NextResponse.json({ success: true, telefono: clean });
    } catch (e: any) {
        console.error('whatsapp-phones POST error:', e);
        return NextResponse.json({ success: false, message: e?.message || 'Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const sp = new URL(req.url).searchParams;
        const projectId = Number(sp.get('projectId'));
        const telefono = sp.get('telefono');
        if (!projectId || !telefono) return NextResponse.json({ success: false, message: 'projectId y telefono requeridos' }, { status: 400 });
        await pool.query('DELETE FROM tblProyectosTelefonos WHERE IdProyecto = ? AND Telefono = ?', [projectId, telefono]);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('whatsapp-phones DELETE error:', e);
        return NextResponse.json({ success: false, message: e?.message || 'Error' }, { status: 500 });
    }
}
