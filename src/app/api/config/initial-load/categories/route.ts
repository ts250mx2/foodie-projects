import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    try {
        // Querying from BDFoodieProjects as requested by user
        const [rows] = await pool.query(
            'SELECT * FROM BDFoodieProjects.tblCategorias WHERE Status = 0 ORDER BY Categoria ASC'
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching categories from BDFoodieProjects:', error);
        return NextResponse.json({ success: false, message: 'Error fetching categories' }, { status: 500 });
    }
}
