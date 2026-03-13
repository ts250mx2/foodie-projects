import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { Connection } from 'mysql2/promise';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection: Connection | undefined;
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        const [rows] = await connection.query(
            `SELECT IdPeriodoNomina, IdSucursal, 
                    DATE_FORMAT(FechaInicio, '%Y-%m-%d') as FechaInicio, 
                    DATE_FORMAT(FechaFin, '%Y-%m-%d') as FechaFin
             FROM tblSucursalesPeriodosNomina 
             WHERE IdSucursal = ? 
             ORDER BY FechaInicio DESC`,
            [id]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching payroll periods:', error);
        return NextResponse.json({ success: false, message: 'Error fetching payroll periods' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection: Connection | undefined;
    try {
        const { id } = await params;
        const body = await request.json();
        const { projectId, fechaInicio, fechaFin } = body;

        if (!projectId || !fechaInicio || !fechaFin) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Check for overlaps
        const [overlaps] = await connection.query<RowDataPacket[]>(
            `SELECT IdPeriodoNomina FROM tblSucursalesPeriodosNomina 
             WHERE IdSucursal = ? AND (
                (FechaInicio <= ? AND FechaFin >= ?) OR
                (FechaInicio <= ? AND FechaFin >= ?) OR
                (? <= FechaInicio AND ? >= FechaInicio)
             )`,
            [id, fechaInicio, fechaInicio, fechaFin, fechaFin, fechaInicio, fechaFin]
        );

        if (overlaps.length > 0) {
            return NextResponse.json({ success: false, message: 'El periodo ya existe' }, { status: 400 });
        }

        await connection.query(
            `INSERT INTO tblSucursalesPeriodosNomina (IdSucursal, FechaInicio, FechaFin, FechaAct) 
             VALUES (?, ?, ?, Now())`,
            [id, fechaInicio, fechaFin]
        );

        return NextResponse.json({
            success: true,
            message: 'Payroll period saved successfully'
        });
    } catch (error) {
        console.error('Error saving payroll period:', error);
        return NextResponse.json({ success: false, message: 'Error saving payroll period' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection: Connection | undefined;
    try {
        const { id } = await params; // id of the branch, though we delete by row id
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const periodId = searchParams.get('periodId');

        if (!projectIdStr || !periodId) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        await connection.query(
            'DELETE FROM tblSucursalesPeriodosNomina WHERE IdPeriodoNomina = ? AND IdSucursal = ?',
            [periodId, id]
        );

        return NextResponse.json({ success: true, message: 'Payroll period deleted successfully' });
    } catch (error) {
        console.error('Error deleting payroll period:', error);
        return NextResponse.json({ success: false, message: 'Error deleting payroll period' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
