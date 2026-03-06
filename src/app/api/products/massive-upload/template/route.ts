import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import ExcelJS from 'exceljs';

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

        // Fetch categories (Status = 0 as requested by user)
        const [categories] = await connection.query(
            'SELECT Categoria FROM BDFoodieProjects.tblCategorias WHERE Status = 0 ORDER BY Categoria ASC'
        ) as any[];

        const categoryNames = categories.length > 0
            ? categories.map(c => c.Categoria)
            : ['(Sin categorías)'];

        console.log(`Excel Template: Found ${categories.length} categories.`);

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Plantilla Carga Masiva');

        // Hidden sheet for data validation source
        const dataSheet = workbook.addWorksheet('DataLists', { state: 'hidden' });

        // Fill categories in hidden sheet
        categoryNames.forEach((name, index) => {
            dataSheet.getCell(`A${index + 1}`).value = name;
        });

        // Add headers to main sheet
        sheet.columns = [
            { header: 'Codigo', key: 'codigo', width: 15 },
            { header: 'Producto', key: 'producto', width: 40 },
            { header: 'Precio', key: 'precio', width: 15 },
            { header: 'Impuesto', key: 'iva', width: 15 },
            { header: 'Categoria', key: 'categoria', width: 25 },
            { header: 'Unidad Medida Compra', key: 'unidadMedidaCompra', width: 25 },
            { header: 'Cantidad', key: 'cantidadCompra', width: 15 },
            { header: 'Unidad Medida Inventario', key: 'unidadMedidaInventario', width: 25 },
            { header: 'Unidad Medida Receta', key: 'unidadMedidaRecetario', width: 25 },
            { header: 'Contenido', key: 'conversionSimple', width: 15 }
        ];

        // Format headers
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF6B35' } // Orange matching the theme
        };
        sheet.getRow(1).alignment = { horizontal: 'center' };

        // Add data validation to 500 rows
        const catRange = `'DataLists'!$A$1:$A$${categoryNames.length}`;

        for (let i = 2; i <= 501; i++) {
            // Category dropdown (Now in column E)
            sheet.getCell(`E${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ["=" + catRange]
            };
        }

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="plantilla_productos.xlsx"',
            },
        });

    } catch (error) {
        console.error('Error generating Excel template:', error);
        return NextResponse.json({ success: false, message: 'Error generating template' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
