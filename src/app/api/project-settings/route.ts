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

        // Fetch project data
        const [projectRows] = await connection.query<any[]>(
            'SELECT NombreArchivoLogo, Proyecto, Titulo, ColorFondo1, ColorFondo2, ColorLetra FROM tblProyectos WHERE IdProyecto = ?',
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
                Logo64: projectRows[0].NombreArchivoLogo || '',
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

        let logoPath = projectData.Logo64; // Keep existing path if no new file

        // If there's a new logo file (Base64), save it to disk
        if (logoFile && logoFile.startsWith('data:image')) {
            const fs = require('fs').promises;
            const path = require('path');

            // Get project UUID
            const [projectRows] = await connection.query<any[]>(
                'SELECT UUID FROM tblProyectos WHERE IdProyecto = ?',
                [projectId]
            );

            if (projectRows.length === 0) {
                return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
            }

            const uuid = projectRows[0].UUID;

            // Extract file extension from Base64 data
            const matches = logoFile.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            if (matches) {
                const extension = matches[1]; // e.g., 'png', 'jpeg', 'jpg'
                const base64Data = matches[2];
                const fileName = `${uuid}.${extension}`;

                // Create logos directory if it doesn't exist
                const logosDir = path.join(process.cwd(), 'public', 'images', 'logos');
                await fs.mkdir(logosDir, { recursive: true });

                // Save file
                const filePath = path.join(logosDir, fileName);
                const buffer = Buffer.from(base64Data, 'base64');
                await fs.writeFile(filePath, buffer);

                // Store path without leading slash for NombreArchivoLogo
                logoPath = `images/logos/${fileName}`;
                console.log('Logo saved to:', logoPath);
            }
        }

        // Update project data with file path in NombreArchivoLogo
        await connection.query(
            'UPDATE tblProyectos SET NombreArchivoLogo = ?, Titulo = ?, ColorFondo1 = ?, ColorFondo2 = ?, ColorLetra = ? WHERE IdProyecto = ?',
            [logoPath, projectData.Titulo, projectData.ColorFondo1, projectData.ColorFondo2, projectData.ColorLetra, projectId]
        );

        // Update user data
        await connection.query(
            'UPDATE tblUsuarios SET Usuario = ?, Telefono = ? WHERE IdUsuario = ?',
            [userData.Usuario, userData.Telefono, userId]
        );

        return NextResponse.json({ success: true, message: 'Settings updated successfully', logoPath });
    } catch (error) {
        console.error('Error updating project settings:', error);
        return NextResponse.json({ success: false, message: 'Error updating settings', error: String(error) }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
