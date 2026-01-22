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

        // Get daily expenses with concept names and payment channel names
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT g.*, c.ConceptoGasto, cp.CanalPago
             FROM tblGastos g
             LEFT JOIN tblConceptosGastos c ON g.IdConceptoGasto = c.IdConceptoGasto
             LEFT JOIN tblCanalesPago cp ON g.IdCanalPago = cp.IdCanalPago
             WHERE g.Dia = ? AND g.Mes = ? AND g.Anio = ? AND g.IdSucursal = ?
             ORDER BY c.ConceptoGasto`,
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
        const amount = parseFloat(formData.get('amount') as string);
        const reference = formData.get('reference') as string || '';
        const paymentChannelId = formData.get('paymentChannelId') as string || null;
        const file = formData.get('file') as File | null;

        if (!projectId || !branchId || day === undefined || month === null || !year || !conceptId || amount === undefined) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const monthNum = month + 1; // Convert to 1-12 for SQL
        connection = await getProjectConnection(projectId);

        let filePath = null;

        // Handle file upload if present
        if (file && file.size > 0) {
            const fs = require('fs').promises;
            const path = require('path');
            const crypto = require('crypto');

            // Generate UUID for file name
            const uuid = crypto.randomUUID();
            const fileExtension = file.name.split('.').pop();
            const fileName = `${uuid}.${fileExtension}`;

            // Get RutaArchivo from project settings (you may need to adjust this)
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'gastos');

            // Create gastos directory if it doesn't exist
            await fs.mkdir(uploadDir, { recursive: true });

            // Save file
            const fileBuffer = Buffer.from(await file.arrayBuffer());
            const fullPath = path.join(uploadDir, fileName);
            await fs.writeFile(fullPath, fileBuffer);

            // Store relative path for database
            filePath = `gastos/${fileName}`;
        }

        // Insert or update expense record - REPLACE instead of accumulate
        const [result] = await connection.query<ResultSetHeader>(
            `INSERT INTO tblGastos (Dia, Mes, Anio, IdConceptoGasto, IdSucursal, Gasto, Referencia, IdCanalPago, RutaArchivo, FechaAct)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, Now())
             ON DUPLICATE KEY UPDATE Gasto = ?, Referencia = ?, IdCanalPago = ?, RutaArchivo = COALESCE(?, RutaArchivo), FechaAct = Now()`,
            [day, monthNum, year, conceptId, branchId, amount, reference, paymentChannelId || null, filePath, amount, reference, paymentChannelId || null, filePath]
        );

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
        const branchIdStr = searchParams.get('branchId');
        const day = searchParams.get('day');
        const month = searchParams.get('month'); // 0-11
        const year = searchParams.get('year');
        const conceptIdStr = searchParams.get('conceptId');

        if (!projectIdStr || !branchIdStr || !day || month === null || !year || !conceptIdStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const monthNum = parseInt(month) + 1; // Convert to 1-12 for SQL
        const conceptId = parseInt(conceptIdStr);
        connection = await getProjectConnection(projectId);

        // Delete expense record
        await connection.query<ResultSetHeader>(
            `DELETE FROM tblGastos 
             WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdSucursal = ? AND IdConceptoGasto = ?`,
            [day, monthNum, year, branchId, conceptId]
        );

        return NextResponse.json({ success: true, message: 'Expense deleted successfully' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        return NextResponse.json({ success: false, message: 'Error deleting expense' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
