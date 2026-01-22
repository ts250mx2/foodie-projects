import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT c.*, cp.CanalPago 
             FROM tblConceptosGastos c
             LEFT JOIN tblCanalesPago cp ON c.IdCanalPago = cp.IdCanalPago
             WHERE c.Status = 0 
             ORDER BY c.ConceptoGasto ASC`
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching expense concepts:', error);
        return NextResponse.json({ success: false, message: 'Error fetching expense concepts' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, concept, requiredReference, paymentChannelId } = body;

        if (!projectId || !concept) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Status = 0 (Active), FechaAct = Now()
        const [result] = await connection.query<ResultSetHeader>(
            'INSERT INTO tblConceptosGastos (ConceptoGasto, ReferenciaObligatoria, IdCanalPago, Status, FechaAct) VALUES (?, ?, ?, 0, Now())',
            [concept, requiredReference || 0, paymentChannelId || null]
        );

        return NextResponse.json({
            success: true,
            message: 'Expense concept created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating expense concept:', error);
        return NextResponse.json({ success: false, message: 'Error creating expense concept' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
