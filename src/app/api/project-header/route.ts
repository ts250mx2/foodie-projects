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

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getFoodieProjectsConnection();

        // Fetch project title and logo
        const [rows] = await connection.query<any[]>(
            'SELECT Titulo, NombreArchivoLogo FROM tblProyectos WHERE IdProyecto = ?',
            [projectId]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        // Add leading slash if path exists and doesn't start with /
        let logoPath = rows[0].NombreArchivoLogo || null;
        if (logoPath && !logoPath.startsWith('/')) {
            logoPath = `/${logoPath}`;
        }

        return NextResponse.json({
            success: true,
            titulo: rows[0].Titulo || null,
            logo64: logoPath
        });
    } catch (error) {
        console.error('Error fetching project header:', error);
        return NextResponse.json({ success: false, message: 'Error fetching project header' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
