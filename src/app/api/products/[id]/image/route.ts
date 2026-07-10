import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

export const runtime = 'nodejs';

/**
 * PATCH /api/products/[id]/image
 * Actualiza SOLO la imagen de un producto (platillo, sub-receta o insumo),
 * sin tocar el resto de sus campos. Body: { projectId, archivoImagen, nombreArchivo }.
 * archivoImagen es un data URL (base64), igual que como se guarda en tblProductos.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let connection;
    try {
        const { id } = await params;
        const { projectId, archivoImagen, nombreArchivo } = await request.json();

        if (!projectId || !archivoImagen) {
            return NextResponse.json({ success: false, message: 'Missing projectId or archivoImagen' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));
        await connection.query(
            'UPDATE tblProductos SET ArchivoImagen = ?, NombreArchivo = ?, FechaAct = Now() WHERE IdProducto = ?',
            [archivoImagen, nombreArchivo || null, parseInt(id)]
        );

        return NextResponse.json({ success: true, message: 'Imagen actualizada' });
    } catch (error) {
        console.error('Error updating product image:', error);
        return NextResponse.json({ success: false, message: 'Error updating product image' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
