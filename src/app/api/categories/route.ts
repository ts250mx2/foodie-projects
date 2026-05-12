import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        // Query global master table BDFoodieProjects.tblCategorias
        const [rows] = await pool.query('SELECT * FROM tblCategorias WHERE Status = 0 ORDER BY Categoria ASC');

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching global categories:', error);
        return NextResponse.json({ success: false, message: 'Error fetching categories' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { category, esRecetario } = body;

        if (!category) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        // Insert into global master table BDFoodieProjects.tblCategorias
        const [result] = await pool.query(
            'INSERT INTO tblCategorias (Categoria, EsRecetario, Status, FechaAct) VALUES (?, ?, 0, Now())',
            [category, esRecetario || 0]
        );

        return NextResponse.json({
            success: true,
            message: 'Global category created successfully',
            id: (result as ResultSetHeader).insertId
        });
    } catch (error) {
        console.error('Error creating global category:', error);
        return NextResponse.json({ success: false, message: 'Error creating category' }, { status: 500 });
    }
}

