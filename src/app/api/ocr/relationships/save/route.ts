import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { Connection } from 'mysql2/promise';

export async function POST(request: NextRequest) {
    let connection: Connection | null = null;
    try {
        const body = await request.json();
        const { projectId, mappings } = body;

        if (!projectId || !mappings || !Array.isArray(mappings)) {
            return NextResponse.json({ success: false, message: 'Missing required fields or invalid mappings' }, { status: 400 });
        }

        const projectIdInt = parseInt(projectId);
        connection = await getProjectConnection(projectIdInt);

        // Start transaction
        await connection.beginTransaction();

        try {
            for (const mapping of mappings) {
                const { ocrDescription, systemId, price } = mapping;

                if (!ocrDescription || !systemId) continue;

                // 1. Update or Insert relationship
                await connection.query(
                    `INSERT INTO tblRelacionProductosOCR (ProductoOCR, IdProducto, FechaAct, Status)
                     VALUES (?, ?, NOW(), 0)
                     ON DUPLICATE KEY UPDATE IdProducto = VALUES(IdProducto), FechaAct = NOW()`,
                    [ocrDescription, systemId]
                );

                // 2. Update Product Price (if price is provided and greater than 0)
                if (price && parseFloat(price) > 0) {
                    await connection.query(
                        `UPDATE tblProductos SET Precio = ?, FechaAct = NOW() WHERE IdProducto = ?`,
                        [parseFloat(price), systemId]
                    );
                }
            }

            await connection.commit();

            return NextResponse.json({
                success: true,
                message: 'Relationships and prices updated successfully'
            });

        } catch (error: any) {
            await connection.rollback();
            throw error;
        }
    } catch (error: any) {
        console.error('Error in saving ocr relationships:', error);
        return NextResponse.json({ success: false, message: 'Error al guardar relaciones: ' + error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
