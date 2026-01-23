import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        const [rows] = (await connection.query(
            `SELECT A.IdProducto, A.Codigo, A.Producto, A.Precio, A.IVA, A.IdPresentacion, A.ConversionSimple, 
                    A.IdPresentacionConversion, A.PesoInicial, A.PesoFinal, A.ObservacionesMerma,
                    CR.CategoriaRecetario as Categoria, CR.IdCategoriaRecetario,
                    C.Presentacion AS UnidadCompra,
                    D.Presentacion AS UnidadConversion
             FROM tblProductos A 
             INNER JOIN tblCategoriasRecetario CR ON A.IdCategoriaRecetario = CR.IdCategoriaRecetario 
             INNER JOIN tblPresentaciones C ON A.IdPresentacion = C.IdPresentacion 
             LEFT JOIN tblPresentaciones D ON A.IdPresentacionConversion = D.IdPresentacion
             WHERE A.IdTipoProducto = 0 
               AND A.Status = 0 
               AND CR.Status = 1 
             ORDER BY CR.CategoriaRecetario, A.Producto`
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching raw materials:', error);
        return NextResponse.json({ success: false, message: 'Error fetching raw materials' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, updates } = body;

        if (!projectId || !Array.isArray(updates)) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Start transaction
        await connection.beginTransaction();

        try {
            // Update all products in batch
            for (const update of updates) {
                const fields = [];
                const values = [];

                if (update.precio !== undefined) {
                    fields.push('Precio = ?');
                    values.push(update.precio);
                }
                if (update.conversionSimple !== undefined) {
                    fields.push('ConversionSimple = ?');
                    values.push(update.conversionSimple);
                }
                if (update.idPresentacionConversion !== undefined) {
                    fields.push('IdPresentacionConversion = ?');
                    values.push(update.idPresentacionConversion);
                }
                if (update.pesoInicial !== undefined) {
                    fields.push('PesoInicial = ?');
                    values.push(update.pesoInicial);
                }
                if (update.pesoFinal !== undefined) {
                    fields.push('PesoFinal = ?');
                    values.push(update.pesoFinal);
                }
                if (update.observacionesMerma !== undefined) {
                    fields.push('ObservacionesMerma = ?');
                    values.push(update.observacionesMerma);
                }

                if (fields.length > 0) {
                    fields.push('FechaAct = NOW()');
                    values.push(update.idProducto);

                    await connection.query(
                        `UPDATE tblProductos SET ${fields.join(', ')} WHERE IdProducto = ?`,
                        values
                    );
                }
            }

            // Commit transaction
            await connection.commit();

            return NextResponse.json({
                success: true,
                message: 'Raw materials updated successfully'
            });
        } catch (error) {
            // Rollback on error
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error updating raw materials:', error);
        return NextResponse.json({ success: false, message: 'Error updating raw materials' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

