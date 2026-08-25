import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { Connection } from 'mysql2/promise';
import { ensureModuleFlagColumns, toFlag } from '@/lib/project-modules';
import { getProjectConnection } from '@/lib/dynamic-db';
import { buildProjectDomain, normalizeProjectDomain } from '@/lib/project-domain';

// Connection to BDFoodieProjects database
async function getFoodieProjectsConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'BDFoodieProjects'
    });
}

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const userIdStr = searchParams.get('userId');

        if (!projectIdStr || !userIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const userId = parseInt(userIdStr);
        connection = await getFoodieProjectsConnection();
        await ensureModuleFlagColumns(connection);

        // Fetch project data (Changed NombreArchivoLogo to Logo64)
        const [projectRows]: any = await connection.query(
            `SELECT Logo64, Proyecto, Titulo, DominioFG, ColorFondo1, ColorFondo2, ColorLetra, AppPriceCalculatorEnabled,
                    RecetarioEnabled, PurchaseOrdersEnabled, POSConnectionEnabled,
                    QuotesEnabled, MinMaxEnabled, SchedulesEnabled, SurveysEnabled
             FROM tblProyectos WHERE IdProyecto = ?`,
            [projectId]
        );

        // Fetch user data
        const [userRows] = await connection.query(
            'SELECT CorreoElectronico, Usuario, Telefono FROM tblUsuarios WHERE IdUsuario = ?',
            [userId]
        );

        if (projectRows.length === 0 || userRows.length === 0) {
            return NextResponse.json({ success: false, message: 'Data not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            projectData: {
                Logo64: projectRows[0].Logo64 ? projectRows[0].Logo64.toString() : '',
                Proyecto: projectRows[0].Proyecto || '',
                Titulo: projectRows[0].Titulo || '',
                DominioFG: projectRows[0].DominioFG || '',
                // El que le tocaria por su nombre: el panel lo ofrece cuando
                // el proyecto todavia no tiene dominio configurado.
                DominioSugerido: buildProjectDomain(projectRows[0].Proyecto),
                ColorFondo1: projectRows[0].ColorFondo1 || '#FF6B35',
                ColorFondo2: projectRows[0].ColorFondo2 || '#F7931E',
                ColorLetra: projectRows[0].ColorLetra || '#FFFFFF',
                AppPriceCalculatorEnabled: projectRows[0].AppPriceCalculatorEnabled !== 0 ? 1 : 0,
                RecetarioEnabled: toFlag(projectRows[0].RecetarioEnabled),
                PurchaseOrdersEnabled: toFlag(projectRows[0].PurchaseOrdersEnabled),
                POSConnectionEnabled: toFlag(projectRows[0].POSConnectionEnabled),
                QuotesEnabled: toFlag(projectRows[0].QuotesEnabled),
                MinMaxEnabled: toFlag(projectRows[0].MinMaxEnabled),
                SchedulesEnabled: toFlag(projectRows[0].SchedulesEnabled),
                SurveysEnabled: toFlag(projectRows[0].SurveysEnabled)
            },
            userData: {
                CorreoElectronico: userRows[0].CorreoElectronico || '',
                Usuario: userRows[0].Usuario || '',
                Telefono: userRows[0].Telefono || ''
            }
        });
    } catch (error) {
        console.error('Error fetching project settings:', error);
        return NextResponse.json({ success: false, message: 'Error fetching settings' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection: Connection | undefined;
    try {
        const body = await request.json();
        const { projectId, userId, projectData, userData, logoFile } = body;

        if (!projectId || !userId) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        connection = await getFoodieProjectsConnection();
        await ensureModuleFlagColumns(connection);

        /* ── Dominio de acceso ─────────────────────────────────────────────
           El dominio es la segunda mitad del login de TODO el personal del
           proyecto. Cambiarlo sin reescribir esos logins deja a todos fuera,
           así que aquí se hacen las dos cosas o ninguna: primero se reescriben
           los logins dentro de una transacción en la BD del proyecto y solo si
           el dominio se guardó en la central se confirma.
        ──────────────────────────────────────────────────────────────────── */
        let dominioAplicado: string | null = null;
        let loginsActualizados = 0;

        if (projectData.DominioFG !== undefined) {
            const nuevoDominio = normalizeProjectDomain(projectData.DominioFG);
            if (!nuevoDominio) {
                return NextResponse.json(
                    { success: false, message: 'El dominio no puede quedar vacío: usa el nombre del proyecto sin espacios.' },
                    { status: 400 }
                );
            }

            const [actualRows] = await connection.query<RowDataPacket[]>(
                'SELECT DominioFG FROM tblProyectos WHERE IdProyecto = ?',
                [projectId]
            );
            const dominioActual = (actualRows[0]?.DominioFG || '').trim().toLowerCase();

            if (nuevoDominio !== dominioActual) {
                // Dos proyectos con el mismo dominio harían imposible saber a
                // cuál pertenece un login.
                const [dup] = await connection.query<RowDataPacket[]>(
                    'SELECT IdProyecto, Proyecto FROM tblProyectos WHERE DominioFG = ? AND IdProyecto <> ? LIMIT 1',
                    [nuevoDominio, projectId]
                );
                if (dup.length > 0) {
                    return NextResponse.json(
                        { success: false, message: `El dominio "${nuevoDominio}" ya lo usa el proyecto "${dup[0].Proyecto}".` },
                        { status: 409 }
                    );
                }

                let projectConn: Connection | undefined;
                try {
                    projectConn = await getProjectConnection(Number(projectId));
                    await projectConn.beginTransaction();

                    const [result] = await projectConn.query<ResultSetHeader>(
                        `UPDATE tblEmpleados
                            SET Login = CONCAT(SUBSTRING_INDEX(Login, '@', 1), '@', ?), FechaAct = Now()
                          WHERE Login IS NOT NULL AND Login <> ''`,
                        [nuevoDominio]
                    );
                    loginsActualizados = result.affectedRows || 0;

                    await connection.query(
                        'UPDATE tblProyectos SET DominioFG = ? WHERE IdProyecto = ?',
                        [nuevoDominio, projectId]
                    );

                    await projectConn.commit();
                    dominioAplicado = nuevoDominio;
                } catch (err) {
                    if (projectConn) await projectConn.rollback().catch(() => { });
                    console.error('Error updating project domain:', err);
                    return NextResponse.json(
                        { success: false, message: 'No se pudo cambiar el dominio; no se modificó ningún acceso.' },
                        { status: 500 }
                    );
                } finally {
                    if (projectConn) await projectConn.end();
                }
            } else {
                dominioAplicado = dominioActual;
            }
        }

        // Prepare Logo64 content
        let finalLogo64 = projectData.Logo64; // Default to existing if not changed

        // If a new logo file is provided (Base64), use it directly
        // The frontend sends the full base64 string in logoFile
        if (logoFile && logoFile.startsWith('data:image')) {
            finalLogo64 = logoFile;
        }

        // Update project data saving Base64 directly to Logo64 column
        // Removed NombreArchivoLogo update as we are using Logo64 now
        await connection.query(
            `UPDATE tblProyectos SET Logo64 = ?, Titulo = ?, ColorFondo1 = ?, ColorFondo2 = ?, ColorLetra = ?,
                    AppPriceCalculatorEnabled = ?, RecetarioEnabled = ?, PurchaseOrdersEnabled = ?, POSConnectionEnabled = ?,
                    QuotesEnabled = ?, MinMaxEnabled = ?, SchedulesEnabled = ?, SurveysEnabled = ?
             WHERE IdProyecto = ?`,
            [
                finalLogo64, projectData.Titulo, projectData.ColorFondo1, projectData.ColorFondo2, projectData.ColorLetra,
                projectData.AppPriceCalculatorEnabled !== 0 ? 1 : 0,
                toFlag(projectData.RecetarioEnabled),
                toFlag(projectData.PurchaseOrdersEnabled),
                toFlag(projectData.POSConnectionEnabled),
                toFlag(projectData.QuotesEnabled),
                toFlag(projectData.MinMaxEnabled),
                toFlag(projectData.SchedulesEnabled),
                toFlag(projectData.SurveysEnabled),
                projectId
            ]
        );

        // Update user data
        await connection.query(
            'UPDATE tblUsuarios SET Usuario = ?, Telefono = ? WHERE IdUsuario = ?',
            [userData.Usuario, userData.Telefono, userId]
        );

        return NextResponse.json({
            success: true,
            message: 'Settings updated successfully',
            logoPath: finalLogo64,
            dominio: dominioAplicado,
            // El panel lo usa para avisar cuántos accesos cambiaron de correo.
            loginsActualizados,
        });
    } catch (error) {
        console.error('Error updating project settings:', error);
        return NextResponse.json({ success: false, message: 'Error updating settings', error: String(error) }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

