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
        const locale = searchParams.get('locale') || 'es';

        connection = await getFoodieProjectsConnection();

        const [rows] = await connection.query(
            'SELECT IdCategoria, Categoria, ImagenCategoria, IdModuloRecetario FROM tblCategorias WHERE Status = 0 AND Idioma = ? ORDER BY Categoria ASC, IdModuloRecetario ASC',
            [locale]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching global categories:', error);
        return NextResponse.json({ success: false, message: 'Error fetching global categories' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
