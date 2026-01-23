import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const dayStr = searchParams.get('day');
        const monthStr = searchParams.get('month'); // 0-11
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || !dayStr || monthStr === null || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const day = parseInt(dayStr);
        const month = parseInt(monthStr) + 1; // Convert to 1-12 for SQL
        const year = parseInt(yearStr);

        connection = await getProjectConnection(projectId);

        // Get daily purchases with provider and payment channel info
        const [rows] = (await connection.query(
            `SELECT A.IdCompra, A.FechaCompra, B.Proveedor, A.NumeroFactura, 
                    C.CanalPago, A.Total, A.Status, A.Referencia, A.PagarA, A.IdProveedor, A.IdCanalPago
             FROM tblCompras A
             INNER JOIN tblProveedores B ON A.IdProveedor = B.IdProveedor
             INNER JOIN tblCanalesPago C ON A.IdCanalPago = C.IdCanalPago
             WHERE A.IdSucursal = ? AND DAY(A.FechaCompra) = ? AND MONTH(A.FechaCompra) = ? AND YEAR(A.FechaCompra) = ?
             ORDER BY A.FechaCompra`,
            [branchId, day, month, year]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching daily purchases:', error);
        return NextResponse.json({ success: false, message: 'Error fetching daily purchases' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, day, month, year, providerId, invoiceNumber, paymentChannelId, reference, payTo, total } = body;

        if (!projectId || !branchId || day === undefined || month === null || !year || !providerId || !invoiceNumber || !paymentChannelId || total === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const monthNum = month + 1; // Convert to 1-12 for SQL
        connection = await getProjectConnection(projectId);

        // Create purchase date
        const purchaseDate = `${year}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        // Insert new purchase
        const [result] = (await connection.query(
            `INSERT INTO tblCompras (IdSucursal, IdProveedor, NumeroFactura, IdCanalPago, Referencia, PagarA, Total, FechaCompra, Status, FechaAct)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
            [branchId, providerId, invoiceNumber.toUpperCase(), paymentChannelId, reference || '', payTo || '', total, purchaseDate]
        );

        return NextResponse.json({
            success: true,
            message: 'Purchase created successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating purchase:', error);
        return NextResponse.json({ success: false, message: 'Error creating purchase' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, purchaseId, providerId, invoiceNumber, paymentChannelId, reference, payTo, total } = body;

        if (!projectId || !purchaseId || !providerId || !invoiceNumber || !paymentChannelId || total === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Update purchase
        await connection.query(
            `UPDATE tblCompras 
             SET IdProveedor = ?, NumeroFactura = ?, IdCanalPago = ?, Referencia = ?, PagarA = ?, Total = ?, FechaAct = NOW()
             WHERE IdCompra = ?`,
            [providerId, invoiceNumber.toUpperCase(), paymentChannelId, reference || '', payTo || '', total, purchaseId]
        );

        return NextResponse.json({
            success: true,
            message: 'Purchase updated successfully'
        });
    } catch (error) {
        console.error('Error updating purchase:', error);
        return NextResponse.json({ success: false, message: 'Error updating purchase' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const purchaseIdStr = searchParams.get('purchaseId');

        if (!projectIdStr || !purchaseIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const purchaseId = parseInt(purchaseIdStr);

        connection = await getProjectConnection(projectId);

        // Soft delete by setting Status = 2
        await connection.query(
            'UPDATE tblCompras SET Status = 2, FechaAct = NOW() WHERE IdCompra = ?',
            [purchaseId]
        );

        return NextResponse.json({
            success: true,
            message: 'Purchase deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting purchase:', error);
        return NextResponse.json({ success: false, message: 'Error deleting purchase' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

