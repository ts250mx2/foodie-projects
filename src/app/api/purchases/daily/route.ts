import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { Connection } from 'mysql2/promise';

export async function GET(request: NextRequest) {
    let connection: Connection | null = null;
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
        const [rows] = await connection.query(
            `SELECT A.IdCompra, A.FechaCompra, B.Proveedor, A.NumeroFactura, 
                    C.CanalPago, A.Total, A.Status, A.Referencia, A.PagarA, A.IdProveedor, A.IdCanalPago,
                    A.ArchivoDocumento
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
    let connection: Connection | null = null;
    try {
        const formData = await request.formData();
        const projectId = parseInt(formData.get('projectId') as string);
        const branchId = parseInt(formData.get('branchId') as string);
        const day = parseInt(formData.get('day') as string);
        const month = parseInt(formData.get('month') as string);
        const year = parseInt(formData.get('year') as string);
        const providerId = parseInt(formData.get('providerId') as string);
        const invoiceNumber = formData.get('invoiceNumber') as string;
        const paymentChannelId = formData.get('paymentChannelId') as string;
        const reference = formData.get('reference') as string || '';
        const payTo = formData.get('payTo') as string || '';
        const total = parseFloat(formData.get('total') as string);
        const file = formData.get('file') as File | null;

        if (!projectId || !branchId || day === undefined || month === null || !year || !providerId || !invoiceNumber || !paymentChannelId || isNaN(total)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const monthNum = month + 1; // Convert to 1-12 for SQL
        connection = await getProjectConnection(projectId);

        // Create purchase date
        const purchaseDate = `${year}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        let base64File = null;
        let fileName = null;
        if (file && file.size > 0) {
            const fileBuffer = Buffer.from(await file.arrayBuffer());
            base64File = fileBuffer.toString('base64');
            fileName = file.name;
        }

        // Insert new purchase
        const [result] = await connection.query<ResultSetHeader>(
            `INSERT INTO tblCompras (IdSucursal, IdProveedor, NumeroFactura, IdCanalPago, Referencia, PagarA, Total, FechaCompra, Status, FechaAct, ArchivoDocumento)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), ?)`,
            [branchId, providerId, invoiceNumber.toUpperCase(), paymentChannelId, reference || '', payTo || '', total, purchaseDate, base64File]
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
    let connection: Connection | null = null;
    try {
        const formData = await request.formData();
        const projectId = parseInt(formData.get('projectId') as string);
        const purchaseId = parseInt(formData.get('purchaseId') as string);
        const file = formData.get('file') as File | null;

        // Also support JSON-like fields if they come via FormData (for regular updates)
        const providerId = formData.get('providerId') ? parseInt(formData.get('providerId') as string) : null;
        const invoiceNumber = formData.get('invoiceNumber') as string | null;
        const paymentChannelId = formData.get('paymentChannelId') as string | null;
        const total = formData.get('total') ? parseFloat(formData.get('total') as string) : null;
        const reference = formData.get('reference') as string | null;
        const payTo = formData.get('payTo') as string | null;

        if (!projectId || !purchaseId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        if (file) {
            // File Upload only update
            const fileBuffer = Buffer.from(await file.arrayBuffer());
            const base64File = fileBuffer.toString('base64');
            const fileName = file.name;

            await connection.query(
                `UPDATE tblCompras 
                 SET ArchivoDocumento = ?, FechaAct = NOW()
                 WHERE IdCompra = ?`,
                [base64File, purchaseId]
            );
        } else if (providerId && invoiceNumber) {
            // Regular update
            await connection.query(
                `UPDATE tblCompras 
                 SET IdProveedor = ?, NumeroFactura = ?, IdCanalPago = ?, Referencia = ?, PagarA = ?, Total = ?, FechaAct = NOW()
                 WHERE IdCompra = ?`,
                [providerId, invoiceNumber.toUpperCase(), paymentChannelId, reference || '', payTo || '', total, purchaseId]
            );
        }

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
    let connection: Connection | null = null;
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

