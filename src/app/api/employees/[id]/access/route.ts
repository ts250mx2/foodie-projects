import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import pool from '@/lib/db';
import { getPermissions, savePermissions } from '@/lib/permissions';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let projectConnection;
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        projectConnection = await getProjectConnection(projectId);

        // Get employee access data
        const [empRows] = await projectConnection.query(
            'SELECT Login, EsAdministrador FROM tblEmpleados WHERE IdEmpleado = ?',
            [id]
        );

        let username = '';
        let isAdmin = false;

        if (empRows.length > 0) {
            const login = empRows[0].Login || '';
            // Extract username from login (before @)
            username = login.includes('@') ? login.split('@')[0] : login;
            isAdmin = empRows[0].EsAdministrador === 1;
        }

        // Domain desde la BD maestra (pool) + permisos del empleado
        const [projectRows]: any = await pool.query(
            'SELECT DominioFG FROM tblProyectos WHERE IdProyecto = ?',
            [projectId]
        );
        const domain = projectRows.length > 0 ? (projectRows[0].DominioFG || '') : '';
        const permissions = await getPermissions(projectConnection, Number(id));

        return NextResponse.json({
            success: true,
            username,
            domain,
            isAdmin,
            permissions,
        });
    } catch (error) {
        console.error('Error fetching employee access:', error);
        return NextResponse.json({ success: false, message: 'Error fetching employee access' }, { status: 500 });
    } finally {
        if (projectConnection) await projectConnection.end();
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let projectConnection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, username, password, isAdmin, permissions } = body;

        if (!projectId || !username) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const projectIdInt = parseInt(projectId);

        // Domain desde la BD maestra (pool)
        const [projectRows]: any = await pool.query(
            'SELECT DominioFG FROM tblProyectos WHERE IdProyecto = ?',
            [projectIdInt]
        );
        if (projectRows.length === 0) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }
        const domain = projectRows[0].DominioFG || '';
        const fullLogin = `${username}@${domain}`;

        projectConnection = await getProjectConnection(projectIdInt);

        if (password) {
            await projectConnection.query(
                'UPDATE tblEmpleados SET Login = ?, Passwd = ?, EsAdministrador = ?, FechaAct = Now() WHERE IdEmpleado = ?',
                [fullLogin, password, isAdmin ? 1 : 0, id]
            );
        } else {
            await projectConnection.query(
                'UPDATE tblEmpleados SET Login = ?, EsAdministrador = ?, FechaAct = Now() WHERE IdEmpleado = ?',
                [fullLogin, isAdmin ? 1 : 0, id]
            );
        }

        // Guardar permisos de menú si se enviaron
        await savePermissions(projectConnection, Number(id), permissions);

        return NextResponse.json({ success: true, message: 'Access updated successfully' });
    } catch (error) {
        console.error('Error saving employee access:', error);
        return NextResponse.json({ success: false, message: 'Error saving employee access' }, { status: 500 });
    } finally {
        if (projectConnection) await projectConnection.end();
    }
}
