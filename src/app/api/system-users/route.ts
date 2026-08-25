import { NextRequest, NextResponse } from 'next/server';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import pool from '@/lib/db';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ADMIN_PERMISSIONS_ID, savePermissions } from '@/lib/permissions';

export const runtime = 'nodejs';

/**
 * Usuarios de sistema del proyecto (Configuración General → Usuarios de sistema).
 *
 * Un usuario de sistema es un renglón de tblEmpleados con Login. Puede ser:
 *  - personal con acceso (EsUsuarioSistema = 0): además es empleado, sale en
 *    nómina y en el módulo de Empleados;
 *  - acceso puro (EsUsuarioSistema = 1): contador externo, socio, soporte. Vive
 *    aquí porque el login y los permisos ya van por IdEmpleado, pero se filtra
 *    de las listas de personal.
 *
 * El ADMINISTRADOR del proyecto entra por tblUsuarios de la BD central, así que
 * no tiene renglón aquí: sus permisos se guardan bajo IdEmpleado = -1
 * (ADMIN_PERMISSIONS_ID).
 *
 * El Login es "usuario@DominioFG": el dominio identifica al proyecto en el
 * login, así que se arma en el servidor y el cliente solo manda la parte local.
 */

/** Parte local del login (antes del @). */
const localPart = (login: string) => (login.includes('@') ? login.split('@')[0] : login);

const cleanText = (value: unknown, maxLen: number): string => {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ').slice(0, maxLen);
};

/** Usuario: sin espacios ni arroba, que va a formar el correo de acceso. */
const cleanUsername = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 60);
};

async function getProjectDomain(projectId: number): Promise<string | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT DominioFG FROM tblProyectos WHERE IdProyecto = ?',
        [projectId]
    );
    if (rows.length === 0) return null;
    return rows[0].DominioFG || '';
}

// GET: usuarios con acceso + permisos del administrador.
export async function GET(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const projectId = Number(new URL(request.url).searchParams.get('projectId'));
        if (!Number.isInteger(projectId) || projectId <= 0) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const domain = await getProjectDomain(projectId);
        if (domain === null) {
            return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 404 });
        }

        connection = await getProjectConnection(projectId);

        // Con acceso = tiene Login. Se incluyen los dos tipos (personal y
        // acceso puro) y se excluyen los dados de baja.
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT e.IdEmpleado, e.Empleado, e.Login, e.CorreoElectronico, e.Telefonos,
                    e.EsAdministrador, e.EsUsuarioSistema, e.IdSucursal, s.Sucursal, p.Puesto
             FROM tblEmpleados e
             LEFT JOIN tblSucursales s ON e.IdSucursal = s.IdSucursal
             LEFT JOIN BDFoodieProjects.tblPuestos p ON e.IdPuesto = p.IdPuesto
             WHERE e.Status = 0 AND e.Login IS NOT NULL AND e.Login <> ''
             ORDER BY e.EsUsuarioSistema ASC, e.Empleado ASC`
        );

        // Permisos de todos en una sola consulta (incluido el administrador).
        const [permRows] = await connection.query<RowDataPacket[]>(
            'SELECT IdEmpleado, MenuKey, Permitido FROM tblEmpleadosPermisos'
        );
        const permsByUser = new Map<number, Record<string, boolean>>();
        for (const r of permRows) {
            const id = Number(r.IdEmpleado);
            if (!permsByUser.has(id)) permsByUser.set(id, {});
            permsByUser.get(id)![r.MenuKey] = Number(r.Permitido) === 1;
        }

        // Empleados sin acceso: para poder darles uno desde esta pantalla.
        const [sinAcceso] = await connection.query<RowDataPacket[]>(
            `SELECT IdEmpleado, Empleado, CorreoElectronico
             FROM tblEmpleados
             WHERE Status = 0 AND (Login IS NULL OR Login = '')
               AND (EsUsuarioSistema IS NULL OR EsUsuarioSistema = 0)
             ORDER BY Empleado ASC`
        );

        return NextResponse.json({
            success: true,
            domain,
            admin: { permissions: permsByUser.get(ADMIN_PERMISSIONS_ID) || {} },
            users: rows.map(u => ({
                idEmpleado: u.IdEmpleado,
                nombre: u.Empleado,
                usuario: localPart(u.Login || ''),
                login: u.Login,
                correo: u.CorreoElectronico,
                telefono: u.Telefonos,
                esAdministrador: Number(u.EsAdministrador) === 1,
                esUsuarioSistema: Number(u.EsUsuarioSistema) === 1,
                sucursal: u.Sucursal,
                puesto: u.Puesto,
                permissions: permsByUser.get(Number(u.IdEmpleado)) || {},
            })),
            empleadosSinAcceso: sinAcceso.map(e => ({
                idEmpleado: e.IdEmpleado,
                nombre: e.Empleado,
                correo: e.CorreoElectronico,
            })),
        });
    } catch (error) {
        console.error('Error listing system users:', error);
        return NextResponse.json({ success: false, message: 'Error al cargar los usuarios' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

/**
 * POST: da de alta un usuario de sistema.
 *  - con idEmpleado: le abre acceso a un empleado que ya existe;
 *  - sin idEmpleado: crea el renglón como acceso puro (EsUsuarioSistema = 1).
 */
export async function POST(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const body = await request.json();
        const { projectId, idEmpleado, nombre, usuario, password, esAdministrador, permissions } = body;

        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const user = cleanUsername(usuario);
        if (!user) {
            return NextResponse.json({ success: false, message: 'Escribe el usuario (solo letras, números, punto, guion)' }, { status: 400 });
        }
        if (typeof password !== 'string' || password.length < 4) {
            return NextResponse.json({ success: false, message: 'La contraseña debe tener al menos 4 caracteres' }, { status: 400 });
        }

        const domain = await getProjectDomain(Number(projectId));
        if (domain === null) {
            return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 404 });
        }
        if (!domain) {
            return NextResponse.json(
                { success: false, message: 'El proyecto no tiene dominio configurado (DominioFG): sin él no se puede armar el usuario de acceso.' },
                { status: 409 }
            );
        }
        const login = `${user}@${domain}`;

        connection = await getProjectConnection(Number(projectId));

        // El login es la credencial: dos iguales en el mismo proyecto harían
        // que uno de los dos nunca pudiera entrar.
        const [dup] = await connection.query<RowDataPacket[]>(
            'SELECT IdEmpleado FROM tblEmpleados WHERE Login = ? AND Status = 0 LIMIT 1',
            [login]
        );
        if (dup.length > 0 && Number(dup[0].IdEmpleado) !== Number(idEmpleado)) {
            return NextResponse.json({ success: false, message: `El usuario "${user}" ya está ocupado` }, { status: 409 });
        }

        let employeeId: number;

        if (idEmpleado) {
            // Empleado existente: solo se le abre el acceso.
            employeeId = Number(idEmpleado);
            await connection.query(
                'UPDATE tblEmpleados SET Login = ?, Passwd = ?, EsAdministrador = ?, FechaAct = Now() WHERE IdEmpleado = ?',
                [login, password, esAdministrador ? 1 : 0, employeeId]
            );
        } else {
            const nombreLimpio = cleanText(nombre, 150);
            if (!nombreLimpio) {
                return NextResponse.json({ success: false, message: 'Escribe el nombre del usuario' }, { status: 400 });
            }
            const [result] = await connection.query<ResultSetHeader>(
                `INSERT INTO tblEmpleados
                    (Empleado, CorreoElectronico, Login, Passwd, EsAdministrador, EsUsuarioSistema, Sueldo, Status, FechaAct)
                 VALUES (?, ?, ?, ?, ?, 1, 0, 0, Now())`,
                [nombreLimpio, cleanText(body.correo, 150) || null, login, password, esAdministrador ? 1 : 0]
            );
            employeeId = result.insertId;
        }

        await savePermissions(connection, employeeId, permissions);

        return NextResponse.json({ success: true, message: 'Usuario creado', idEmpleado: employeeId, login });
    } catch (error) {
        console.error('Error creating system user:', error);
        return NextResponse.json({ success: false, message: 'Error al crear el usuario' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

/**
 * PUT: actualiza un usuario y/o sus permisos.
 * Con idEmpleado = ADMIN_PERMISSIONS_ID solo se guardan permisos: el
 * administrador no tiene renglón en tblEmpleados.
 */
export async function PUT(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const body = await request.json();
        const { projectId, idEmpleado, nombre, usuario, password, esAdministrador, permissions } = body;

        if (!projectId || idEmpleado === undefined || idEmpleado === null) {
            return NextResponse.json({ success: false, message: 'Faltan datos del usuario' }, { status: 400 });
        }

        const employeeId = Number(idEmpleado);
        connection = await getProjectConnection(Number(projectId));

        if (employeeId === ADMIN_PERMISSIONS_ID) {
            await savePermissions(connection, ADMIN_PERMISSIONS_ID, permissions);
            return NextResponse.json({ success: true, message: 'Permisos del administrador actualizados' });
        }

        const sets: string[] = [];
        const values: unknown[] = [];

        const nombreLimpio = cleanText(nombre, 150);
        if (nombreLimpio) { sets.push('Empleado = ?'); values.push(nombreLimpio); }

        if (usuario !== undefined) {
            const user = cleanUsername(usuario);
            if (!user) {
                return NextResponse.json({ success: false, message: 'Usuario no válido' }, { status: 400 });
            }
            const domain = await getProjectDomain(Number(projectId));
            if (!domain) {
                return NextResponse.json({ success: false, message: 'El proyecto no tiene dominio configurado' }, { status: 409 });
            }
            const login = `${user}@${domain}`;
            const [dup] = await connection.query<RowDataPacket[]>(
                'SELECT IdEmpleado FROM tblEmpleados WHERE Login = ? AND IdEmpleado <> ? AND Status = 0 LIMIT 1',
                [login, employeeId]
            );
            if (dup.length > 0) {
                return NextResponse.json({ success: false, message: `El usuario "${user}" ya está ocupado` }, { status: 409 });
            }
            sets.push('Login = ?'); values.push(login);
        }

        // Contraseña opcional: vacía = se conserva la actual.
        if (typeof password === 'string' && password.length > 0) {
            if (password.length < 4) {
                return NextResponse.json({ success: false, message: 'La contraseña debe tener al menos 4 caracteres' }, { status: 400 });
            }
            sets.push('Passwd = ?'); values.push(password);
        }

        if (esAdministrador !== undefined) {
            sets.push('EsAdministrador = ?'); values.push(esAdministrador ? 1 : 0);
        }

        if (sets.length > 0) {
            sets.push('FechaAct = Now()');
            values.push(employeeId);
            await connection.query(`UPDATE tblEmpleados SET ${sets.join(', ')} WHERE IdEmpleado = ?`, values);
        }

        await savePermissions(connection, employeeId, permissions);

        return NextResponse.json({ success: true, message: 'Usuario actualizado' });
    } catch (error) {
        console.error('Error updating system user:', error);
        return NextResponse.json({ success: false, message: 'Error al actualizar el usuario' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

/**
 * DELETE: quita el acceso.
 *  - Personal: conserva al empleado y solo le retira Login/Passwd.
 *  - Acceso puro: el renglón no representa a nadie más, se da de baja completo
 *    junto con sus permisos.
 */
export async function DELETE(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = Number(searchParams.get('projectId'));
        const idEmpleado = Number(searchParams.get('idEmpleado'));

        if (!Number.isInteger(projectId) || !Number.isInteger(idEmpleado) || idEmpleado <= 0) {
            return NextResponse.json({ success: false, message: 'Faltan datos del usuario' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        const [rows] = await connection.query<RowDataPacket[]>(
            'SELECT EsUsuarioSistema FROM tblEmpleados WHERE IdEmpleado = ?',
            [idEmpleado]
        );
        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: 'Usuario no encontrado' }, { status: 404 });
        }

        if (Number(rows[0].EsUsuarioSistema) === 1) {
            await connection.query('DELETE FROM tblEmpleadosPermisos WHERE IdEmpleado = ?', [idEmpleado]);
            await connection.query(
                'UPDATE tblEmpleados SET Status = 2, Login = NULL, Passwd = NULL, FechaAct = Now() WHERE IdEmpleado = ?',
                [idEmpleado]
            );
            return NextResponse.json({ success: true, message: 'Usuario eliminado' });
        }

        await connection.query(
            'UPDATE tblEmpleados SET Login = NULL, Passwd = NULL, EsAdministrador = 0, FechaAct = Now() WHERE IdEmpleado = ?',
            [idEmpleado]
        );
        return NextResponse.json({ success: true, message: 'Acceso retirado; el empleado se conserva' });
    } catch (error) {
        console.error('Error deleting system user:', error);
        return NextResponse.json({ success: false, message: 'Error al quitar el acceso' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
