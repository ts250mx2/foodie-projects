import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const resolvedParams = await params;
        const projectId = parseInt(projectIdStr);
        const productId = parseInt(resolvedParams.id);
        connection = await getProjectConnection(projectId);

        // Ensure table exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tblProductosInstrucciones (
                IdProducto INT NOT NULL,
                NumeroPaso INT NOT NULL,
                Instrucciones TEXT,
                RutaArchivo VARCHAR(500),
                FechaAct DATETIME,
                PRIMARY KEY (IdProducto, NumeroPaso)
            )
        `);

        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT IdProducto, NumeroPaso, Instrucciones, RutaArchivo, FechaAct
             FROM tblProductosInstrucciones
             WHERE IdProducto = ?
             ORDER BY NumeroPaso ASC`,
            [productId]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching product instructions:', error);
        return NextResponse.json({ success: false, message: 'Error fetching product instructions' }, { status: 500 });
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
        const body = await request.json();
        const { projectId, instructions } = body;

        if (!projectId || !Array.isArray(instructions)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const resolvedParams = await params;
        const productId = parseInt(resolvedParams.id);
        connection = await getProjectConnection(projectId);

        // Ensure table exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tblProductosInstrucciones (
                IdProducto INT NOT NULL,
                NumeroPaso INT NOT NULL,
                Instrucciones TEXT,
                RutaArchivo VARCHAR(500),
                FechaAct DATETIME,
                PRIMARY KEY (IdProducto, NumeroPaso)
            )
        `);

        await connection.beginTransaction();

        try {
            // Delete all existing instructions for this product
            await connection.query<ResultSetHeader>(
                'DELETE FROM tblProductosInstrucciones WHERE IdProducto = ?',
                [productId]
            );

            // Insert new instructions with renumbered steps
            for (let i = 0; i < instructions.length; i++) {
                const instruction = instructions[i];
                await connection.query<ResultSetHeader>(
                    `INSERT INTO tblProductosInstrucciones (IdProducto, NumeroPaso, Instrucciones, RutaArchivo, FechaAct)
                     VALUES (?, ?, ?, ?, NOW())`,
                    [productId, i + 1, instruction.instrucciones, instruction.rutaArchivo || null]
                );
            }

            await connection.commit();

            return NextResponse.json({
                success: true,
                message: 'Instructions saved successfully'
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error saving product instructions:', error);
        return NextResponse.json({ success: false, message: 'Error saving product instructions' }, { status: 500 });
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
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const stepStr = searchParams.get('step');

        if (!projectIdStr || !stepStr) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const resolvedParams = await params;
        const projectId = parseInt(projectIdStr);
        const productId = parseInt(resolvedParams.id);
        const step = parseInt(stepStr);

        connection = await getProjectConnection(projectId);

        await connection.beginTransaction();

        try {
            // Delete the specific step
            await connection.query<ResultSetHeader>(
                'DELETE FROM tblProductosInstrucciones WHERE IdProducto = ? AND NumeroPaso = ?',
                [productId, step]
            );

            // Renumber remaining steps
            const [remainingSteps] = await connection.query<RowDataPacket[]>(
                `SELECT IdProducto, NumeroPaso, Instrucciones, RutaArchivo
                 FROM tblProductosInstrucciones
                 WHERE IdProducto = ?
                 ORDER BY NumeroPaso ASC`,
                [productId]
            );

            // Delete all and reinsert with new numbers
            await connection.query<ResultSetHeader>(
                'DELETE FROM tblProductosInstrucciones WHERE IdProducto = ?',
                [productId]
            );

            for (let i = 0; i < remainingSteps.length; i++) {
                const step = remainingSteps[i];
                await connection.query<ResultSetHeader>(
                    `INSERT INTO tblProductosInstrucciones (IdProducto, NumeroPaso, Instrucciones, RutaArchivo, FechaAct)
                     VALUES (?, ?, ?, ?, NOW())`,
                    [productId, i + 1, step.Instrucciones, step.RutaArchivo]
                );
            }

            await connection.commit();

            return NextResponse.json({ success: true, message: 'Instruction deleted successfully' });
        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error deleting instruction:', error);
        return NextResponse.json({ success: false, message: 'Error deleting instruction' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
