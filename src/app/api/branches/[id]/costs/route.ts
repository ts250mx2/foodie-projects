import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        const [rows] = (await connection.query(
            `SELECT * FROM tblSucursalesCostos 
             WHERE IdSucursal = ? 
             ORDER BY Anio DESC, Mes DESC`,
            [id]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching branch costs:', error);
        return NextResponse.json({ success: false, message: 'Error fetching branch costs' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, month, year, salesObjective, rawMaterialCost, payrollCost, operatingExpense } = body;

        if (!projectId || month === undefined || year === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // UPSERT logic: Using REPLACE INTO or INSERT ... ON DUPLICATE KEY UPDATE
        // The requirement says: "si guarda un mes y año que ya esta en la tabla que lo reemplace"
        // Since (IdSucursal, Mes, Anio) is the PK, REPLACE INTO works perfectly.

        await connection.query(
            `REPLACE INTO tblSucursalesCostos (IdSucursal, Mes, Anio, ObjetivoVentas, CostoMateriaPrima, CostoNomina, GastoOperativo, FechaAct) 
             VALUES (?, ?, ?, ?, ?, ?, ?, Now())`,
            [id, month, year, salesObjective, rawMaterialCost, payrollCost, operatingExpense]
        );

        return NextResponse.json({
            success: true,
            message: 'Branch costs saved successfully'
        });
    } catch (error) {
        console.error('Error saving branch costs:', error);
        return NextResponse.json({ success: false, message: 'Error saving branch costs' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const monthStr = searchParams.get('month');
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !monthStr || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const month = parseInt(monthStr);
        const year = parseInt(yearStr);

        connection = await getProjectConnection(projectId);

        await connection.query(
            'DELETE FROM tblSucursalesCostos WHERE IdSucursal = ? AND Mes = ? AND Anio = ?',
            [id, month, year]
        );

        return NextResponse.json({
            success: true,
            message: 'Branch cost deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting branch cost:', error);
        return NextResponse.json({ success: false, message: 'Error deleting branch cost' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
