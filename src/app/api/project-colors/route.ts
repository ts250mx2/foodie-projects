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

        // Fetch project colors
        const [rows] = await connection.query(
            'SELECT ColorFondo1, ColorFondo2, ColorLetra FROM tblProyectos WHERE IdProyecto = ?',
            [projectId]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            colorFondo1: rows[0].ColorFondo1 || null,
            colorFondo2: rows[0].ColorFondo2 || null,
            colorLetra: rows[0].ColorLetra || null
        });
    } catch (error) {
        console.error('Error fetching project colors:', error);
        return NextResponse.json({ success: false, message: 'Error fetching colors' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

