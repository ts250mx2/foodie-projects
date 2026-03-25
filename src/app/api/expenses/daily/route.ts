import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const day = searchParams.get('day');
        const month = searchParams.get('month'); // 0-11
        const year = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || !day || month === null || !year) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const monthNum = parseInt(month) + 1; // Convert to 1-12 for SQL
        connection = await getProjectConnection(projectId);

        // Get daily expenses with concept names, payment channel names, and provider names
        const [rows] = await connection.query(
            `SELECT g.*, c.ConceptoGasto, cp.CanalPago, p.Proveedor
             FROM tblGastos g
             LEFT JOIN tblConceptosGastos c ON g.IdConceptoGasto = c.IdConceptoGasto
             LEFT JOIN tblCanalesPago cp ON g.IdCanalPago = cp.IdCanalPago
             LEFT JOIN tblProveedores p ON g.IdProveedor = p.IdProveedor
             WHERE g.Dia = ? AND g.Mes = ? AND g.Anio = ? AND g.IdSucursal = ?
             ORDER BY g.IdGasto DESC`,
            [day, monthNum, year, branchId]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching daily expenses:', error);
        return NextResponse.json({ success: false, message: 'Error fetching daily expenses' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const formData = await request.formData();
        const projectId = parseInt(formData.get('projectId') as string);
        const branchId = parseInt(formData.get('branchId') as string);
        const day = parseInt(formData.get('day') as string);
        const month = parseInt(formData.get('month') as string);
        const year = parseInt(formData.get('year') as string);
        const conceptId = parseInt(formData.get('conceptId') as string);
        const providerId = formData.get('providerId') ? parseInt(formData.get('providerId') as string) : null;
        const amount = parseFloat(formData.get('amount') as string);
        const reference = formData.get('reference') as string || '';
        const invoiceNumber = formData.get('invoiceNumber') as string || '';
        const paymentChannelId = formData.get('paymentChannelId') as string || null;
        const file = formData.get('file') as File | null;
        const idGasto = formData.get('idGasto') ? parseInt(formData.get('idGasto') as string) : null;

        if (!projectId || !branchId || day === undefined || month === null || !year || !conceptId || amount === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const monthNum = month + 1; // Convert to 1-12 for SQL
        connection = await getProjectConnection(projectId);

        let base64File = null;
        let fileName = null;

        if (file && file.size > 0) {
            const fileBuffer = Buffer.from(await file.arrayBuffer());
            base64File = fileBuffer.toString('base64');
            fileName = file.name;
        }

        if (idGasto) {
            // Update existing expense
            await connection.query(
                `UPDATE tblGastos 
                 SET IdProveedor = ?, IdConceptoGasto = ?, Total = ?, NumeroFactura = ?, 
                     IdCanalPago = ?, ArchivoDocumento = COALESCE(?, ArchivoDocumento),  FechaAct = Now()
                 WHERE IdGasto = ?`,
                [providerId, conceptId, amount, invoiceNumber, paymentChannelId || null, base64File, idGasto]
            );
        } else {
            // Insert new expense
            await connection.query(
                `INSERT INTO tblGastos (Dia, Mes, Anio, IdConceptoGasto, IdSucursal, IdProveedor, Total, NumeroFactura, IdCanalPago, ArchivoDocumento, FechaAct, Status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, Now(), 0)`,
                [day, monthNum, year, conceptId, branchId, providerId, amount, invoiceNumber, paymentChannelId || null, base64File]
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Expense saved successfully'
        });
    } catch (error) {
        console.error('Error saving expense:', error);
        return NextResponse.json({ success: false, message: 'Error saving expense' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const idGastoStr = searchParams.get('idGasto');

        if (!projectIdStr || !idGastoStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const idGasto = parseInt(idGastoStr);
        connection = await getProjectConnection(projectId);

        // Delete details first
        await connection.query(`DELETE FROM tblDetalleGastos WHERE IdGasto = ?`, [idGasto]);

        // Delete expense header
        await connection.query(`DELETE FROM tblGastos WHERE IdGasto = ?`, [idGasto]);

        return NextResponse.json({ success: true, message: 'Expense deleted successfully' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        return NextResponse.json({ success: false, message: 'Error deleting expense' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const formData = await request.formData();
        const projectId = parseInt(formData.get('projectId') as string);
        const idGasto = parseInt(formData.get('idGasto') as string);
        const file = formData.get('file') as File | null;

        if (!projectId || !idGasto || !file) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        let base64File = null;
        let fileName = null;

        if (file && file.size > 0) {
            const fileBuffer = Buffer.from(await file.arrayBuffer());
            base64File = fileBuffer.toString('base64');
            fileName = file.name;
        }

        await connection.query(
            `UPDATE tblGastos 
             SET ArchivoDocumento = ?, NombreArchivo = ?, FechaAct = Now()
             WHERE IdGasto = ?`,
            [base64File, fileName, idGasto]
        );

        return NextResponse.json({
            success: true,
            message: 'File uploaded successfully'
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        return NextResponse.json({ success: false, message: 'Error uploading file' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}



