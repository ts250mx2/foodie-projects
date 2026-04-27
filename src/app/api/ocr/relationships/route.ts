import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2/promise';

export async function GET(request: NextRequest) {
    let connection = null;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Missing projectId' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // Ensure tables exist
        await connection.query(`CREATE TABLE IF NOT EXISTS tblRelacionProveedoresOCR (
            IdRelacionProveedorOCR INT AUTO_INCREMENT PRIMARY KEY,
            ProveedorOCR VARCHAR(255),
            IdProveedor INT,
            FechaAct DATETIME,
            Status INT,
            UNIQUE KEY (ProveedorOCR)
        )`);

        await connection.query(`CREATE TABLE IF NOT EXISTS tblRelacionProductosOCR (
            IdRelacionProductoOCR INT AUTO_INCREMENT PRIMARY KEY,
            ProductoOCR VARCHAR(255),
            IdProducto INT,
            FechaAct DATETIME,
            Status INT,
            UNIQUE KEY (ProductoOCR)
        )`);

        // Fetch Provider mappings
        const [providerRows] = await connection.query(
            `SELECT ProveedorOCR, IdProveedor FROM tblRelacionProveedoresOCR WHERE Status = 0`
        );

        // Fetch Product mappings
        const [productRows] = await connection.query(
            `SELECT ProductoOCR, IdProducto FROM tblRelacionProductosOCR WHERE Status = 0`
        );

        return NextResponse.json({
            success: true,
            data: {
                providers: providerRows,
                products: productRows
            }
        });

    } catch (error: any) {
        console.error('Error fetching OCR relationships:', error);
        return NextResponse.json({ success: false, message: 'Error fetching relationships: ' + error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
export async function POST(request: NextRequest) {
    let connection = null;
    try {
        const body = await request.json();
        const { projectId, type, ocrName, systemId } = body;

        if (!projectId || !type || !ocrName || !systemId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        if (type === 'provider') {
            await connection.query(
                `INSERT INTO tblRelacionProveedoresOCR (ProveedorOCR, IdProveedor, FechaAct, Status)
                 VALUES (?, ?, NOW(), 0)
                 ON DUPLICATE KEY UPDATE IdProveedor = VALUES(IdProveedor), FechaAct = NOW()`,
                [ocrName, systemId]
            );
        } else if (type === 'product') {
            await connection.query(
                `INSERT INTO tblRelacionProductosOCR (ProductoOCR, IdProducto, FechaAct, Status)
                 VALUES (?, ?, NOW(), 0)
                 ON DUPLICATE KEY UPDATE IdProducto = VALUES(IdProducto), FechaAct = NOW()`,
                [ocrName, systemId]
            );
        }

        return NextResponse.json({ success: true, message: 'Relación guardada exitosamente' });

    } catch (error: any) {
        console.error('Error saving OCR relationship:', error);
        return NextResponse.json({ success: false, message: 'Error saving relationship: ' + error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
