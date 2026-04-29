import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const expenseIdStr = searchParams.get('expenseId');

        if (!projectIdStr || !expenseIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const expenseId = parseInt(expenseIdStr);
        connection = await getProjectConnection(projectId);

        const [rows] = await connection.query(
            `SELECT * FROM tblDetalleGastos WHERE IdGasto = ? AND Status = 0 ORDER BY IdDetalleGasto ASC`,
            [expenseId]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching expense details:', error);
        return NextResponse.json({ success: false, message: 'Error fetching expense details' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, expenseId, concept, quantity, cost } = body;

        if (!projectId || !expenseId || !concept || quantity === undefined || cost === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        await connection.query(
            `INSERT INTO tblDetalleGastos (IdGasto, Concepto, Cantidad, Costo, Status, FechaAct)
             VALUES (?, ?, ?, ?, 0, NOW())`,
            [expenseId, concept, quantity, cost]
        );

        // Update total in header
        await connection.query(
            `UPDATE tblGastos g 
             SET Total = (SELECT SUM(Cantidad * Costo) FROM tblDetalleGastos WHERE IdGasto = ? AND Status = 0)
             WHERE IdGasto = ?`,
            [expenseId, expenseId]
        );

        return NextResponse.json({ success: true, message: 'Detail added successfully' });
    } catch (error) {
        console.error('Error adding expense detail:', error);
        return NextResponse.json({ success: false, message: 'Error adding expense detail' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, detailId, concept, quantity, cost } = body;

        if (!projectId || !detailId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Get expenseId first for total update
        const [rows] = await connection.query(
            `SELECT IdGasto FROM tblDetalleGastos WHERE IdDetalleGasto = ?`,
            [detailId]
        );
        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: 'Detail not found' }, { status: 404 });
        }
        const expenseId = rows[0].IdGasto;

        await connection.query(
            `UPDATE tblDetalleGastos 
             SET Concepto = COALESCE(?, Concepto), 
                 Cantidad = COALESCE(?, Cantidad), 
                 Costo = COALESCE(?, Costo), 
                 FechaAct = NOW()
             WHERE IdDetalleGasto = ?`,
            [concept, quantity, cost, detailId]
        );

        // Update total in header
        await connection.query(
            `UPDATE tblGastos g 
             SET Total = (SELECT SUM(Cantidad * Costo) FROM tblDetalleGastos WHERE IdGasto = ? AND Status = 0)
             WHERE IdGasto = ?`,
            [expenseId, expenseId]
        );

        return NextResponse.json({ success: true, message: 'Detail updated successfully' });
    } catch (error) {
        console.error('Error updating expense detail:', error);
        return NextResponse.json({ success: false, message: 'Error updating expense detail' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const detailIdStr = searchParams.get('detailId');

        if (!projectIdStr || !detailIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const detailId = parseInt(detailIdStr);
        connection = await getProjectConnection(projectId);

        // Get expenseId first for total update
        const [rows] = await connection.query(
            `SELECT IdGasto FROM tblDetalleGastos WHERE IdDetalleGasto = ?`,
            [detailId]
        );
        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: 'Detail not found' }, { status: 404 });
        }
        const expenseId = rows[0].IdGasto;

        await connection.query(`DELETE FROM tblDetalleGastos WHERE IdDetalleGasto = ?`, [detailId]);

        // Update total in header
        await connection.query(
            `UPDATE tblGastos g 
             SET Total = COALESCE((SELECT SUM(Cantidad * Costo) FROM tblDetalleGastos WHERE IdGasto = ? AND Status = 0), 0)
             WHERE IdGasto = ?`,
            [expenseId, expenseId]
        );

        return NextResponse.json({ success: true, message: 'Detail deleted successfully' });
    } catch (error) {
        console.error('Error deleting expense detail:', error);
        return NextResponse.json({ success: false, message: 'Error deleting expense detail' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
