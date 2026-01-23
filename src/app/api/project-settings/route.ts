import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

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

        // Fetch project data (Changed NombreArchivoLogo to Logo64)
        const [projectRows] = await connection.query<any[]>(
            'SELECT Logo64, Proyecto, Titulo, ColorFondo1, ColorFondo2, ColorLetra FROM tblProyectos WHERE IdProyecto = ?',
            [projectId]
        );

        // Fetch user data
        const [userRows] = await connection.query<any[]>(
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
                ColorFondo1: projectRows[0].ColorFondo1 || '#FF6B35',
                ColorFondo2: projectRows[0].ColorFondo2 || '#F7931E',
                ColorLetra: projectRows[0].ColorLetra || '#FFFFFF'
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
    let connection;
    try {
        const body = await request.json();
        const { projectId, userId, projectData, userData, logoFile } = body;

        if (!projectId || !userId) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        connection = await getFoodieProjectsConnection();

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
            'UPDATE tblProyectos SET Logo64 = ?, Titulo = ?, ColorFondo1 = ?, ColorFondo2 = ?, ColorLetra = ? WHERE IdProyecto = ?',
            [finalLogo64, projectData.Titulo, projectData.ColorFondo1, projectData.ColorFondo2, projectData.ColorLetra, projectId]
        );

        // Update user data
        await connection.query(
            'UPDATE tblUsuarios SET Usuario = ?, Telefono = ? WHERE IdUsuario = ?',
            [userData.Usuario, userData.Telefono, userId]
        );

        return NextResponse.json({ success: true, message: 'Settings updated successfully', logoPath: finalLogo64 });
    } catch (error) {
        console.error('Error updating project settings:', error);
        return NextResponse.json({ success: false, message: 'Error updating settings', error: String(error) }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
