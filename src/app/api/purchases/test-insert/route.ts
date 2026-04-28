import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { ResultSetHeader } from 'mysql2/promise';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectId = parseInt(searchParams.get('projectId') || '1');
        connection = await getProjectConnection(projectId);

        // Try a dummy insert to test ArchivoDocumento
        try {
            const [result] = await connection.query(
                `INSERT INTO tblCompras (IdSucursal, IdProveedor, NumeroFactura, IdCanalPago, Total, FechaCompra, Status, FechaAct, ArchivoDocumento)
                 VALUES (?, ?, ?, ?, ?, NOW(), 0, NOW(), ?)`,
                [1, 1, 'TEST-FILE', 1, 100, 'TEST_CONTENT_BASE64']
            ) as [ResultSetHeader, any];
            return NextResponse.json({ success: true, message: 'Insert worked', id: result.insertId });
        } catch (e: any) {
             return NextResponse.json({ success: false, message: 'Insert failed: ' + e.message });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
