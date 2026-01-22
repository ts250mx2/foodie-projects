import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const profileId = searchParams.get('profileId');
        const positionId = searchParams.get('positionId');

        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);

        if (!profileId || !positionId) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 }
            );
        }


        const connection = await getProjectConnection(projectId);

        // Try to get earnings for specific position
        let [rows] = await connection.query(
            `SELECT Porcentaje, Monto 
            FROM tblPerfilesPropinasIngresos 
            WHERE IdPerfilPropina = ? AND IdPuesto = ?`,
            [profileId, positionId]
        );

        // If not found, try default (IdPuesto = 0)
        if ((rows as any[]).length === 0) {
            [rows] = await connection.query(
                `SELECT Porcentaje, Monto 
                FROM tblPerfilesPropinasIngresos 
                WHERE IdPerfilPropina = ? AND IdPuesto = 0`,
                [profileId]
            );
        }

        await connection.end();

        if ((rows as any[]).length === 0) {
            return NextResponse.json({
                success: true,
                data: { Porcentaje: 0, Monto: 0 }
            });
        }

        return NextResponse.json({ success: true, data: (rows as any[])[0] });
    } catch (error: any) {
        console.error('Error fetching profile earnings:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
