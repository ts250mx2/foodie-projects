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
        // Changed NombreArchivoLogo to Logo64
        const [rows] = await connection.query(
            'SELECT Titulo, Logo64 FROM tblProyectos WHERE IdProyecto = ?',
            [projectId]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        // Return Logo64 directly (base64 string)
        const logoData = rows[0].Logo64 || null;

        return NextResponse.json({
            success: true,
            titulo: rows[0].Titulo || null,
            logo64: logoData
        });
    } catch (error) {
        console.error('Error fetching project header:', error);
        return NextResponse.json({ success: false, message: 'Error fetching project header' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

