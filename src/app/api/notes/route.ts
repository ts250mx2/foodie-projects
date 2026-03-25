import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2';

async function ensureTableExists(connection: any) {
    const query = `
        CREATE TABLE IF NOT EXISTS tblNotas (
            IdNota INT AUTO_INCREMENT PRIMARY KEY,
            Dia INT NOT NULL,
            Mes INT NOT NULL,
            Anio INT NOT NULL,
            FechaNota DATE NOT NULL,
            FechaAct DATETIME NOT NULL,
            IdSucursal INT NOT NULL,
            Nota TEXT NOT NULL,
            ArchivoNota LONGTEXT DEFAULT NULL,
            Status INT NOT NULL DEFAULT 0
        ) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_bin;
    `;
    await connection.query(query);
}

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const branchId = searchParams.get('branchId');
        const day = searchParams.get('day');
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        if (!projectId || !branchId || !day || !month || !year) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));
        await ensureTableExists(connection);

        const [rows] = await connection.query(
            `SELECT * FROM tblNotas 
             WHERE IdSucursal = ? AND Dia = ? AND Mes = ? AND Anio = ? AND Status = 0
             ORDER BY FechaAct DESC`,
            [branchId, day, month, year]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error in notes GET:', error);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, day, month, year, note, file } = body;

        if (!projectId || !branchId || !day || !month || !year || !note) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));
        await ensureTableExists(connection);

        // Convert 0-indexed month to 1-indexed for DB string
        const monthInt = parseInt(month);
        const yearInt = parseInt(year);
        const dayInt = parseInt(day);
        const fechaNota = `${yearInt}-${String(monthInt + 1).padStart(2, '0')}-${String(dayInt).padStart(2, '0')}`;

        const [result] = await connection.query(
            `INSERT INTO tblNotas (Dia, Mes, Anio, FechaNota, FechaAct, IdSucursal, Nota, ArchivoNota, Status)
             VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, 0)`,
            [dayInt, monthInt, yearInt, fechaNota, branchId, note, file || null]
        );

        return NextResponse.json({
            success: true,
            message: 'Note created successfully',
            id: (result as ResultSetHeader).insertId
        });
    } catch (error) {
        console.error('Error in notes POST:', error);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, noteId, note, file, status } = body;

        if (!projectId || !noteId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        const updates = [];
        const values = [];

        if (note !== undefined) {
            updates.push('Nota = ?');
            values.push(note);
        }
        if (file !== undefined) {
            updates.push('ArchivoNota = ?');
            values.push(file);
        }
        if (status !== undefined) {
            updates.push('Status = ?');
            values.push(status);
        }

        // Always update modification time 
        updates.push('FechaAct = NOW()');

        if (updates.length > 1) { // More than just FechaAct
            const query = `UPDATE tblNotas SET ${updates.join(', ')} WHERE IdNota = ?`;
            values.push(noteId);
            await connection.query(query, values);
        }

        return NextResponse.json({ success: true, message: 'Note updated successfully' });
    } catch (error) {
        console.error('Error in notes PUT:', error);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
