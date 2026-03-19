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

        // Fetch project title and colors
        const [rows]: any = await connection.query(
            'SELECT Titulo, Logo64, ColorFondo1, ColorFondo2, ColorLetra FROM tblProyectos WHERE IdProyecto = ?',
            [projectId]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            titulo: rows[0].Titulo || null,
            logo64: rows[0].Logo64 || null,
            colorFondo1: rows[0].ColorFondo1 || '#FF6B35',
            colorFondo2: rows[0].ColorFondo2 || '#F7931E',
            colorLetra: rows[0].ColorLetra || '#FFFFFF'
        });
    } catch (error) {
        console.error('Error fetching project header:', error);
        return NextResponse.json({ success: false, message: 'Error fetching project header' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

