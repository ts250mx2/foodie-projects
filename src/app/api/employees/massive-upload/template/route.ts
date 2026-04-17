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

        // Fetch positions from BDFoodieProjects as requested
        const [positions] = await connection.query(
            'SELECT Puesto FROM BDFoodieProjects.tblPuestos WHERE Status = 0 ORDER BY Puesto ASC'
        ) as any[];

        // Fetch branches from project DB
        const [branches] = await connection.query(
            'SELECT Sucursal FROM tblSucursales WHERE Status = 0 ORDER BY Sucursal ASC'
        ) as any[];

        const positionNames = positions.length > 0 ? positions.map(p => p.Puesto) : ['(Sin puestos)'];
        const branchNames = branches.length > 0 ? branches.map(b => b.Sucursal) : ['(Sin sucursales)'];

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Plantilla Empleados');

        // Hidden sheet for data validation source
        const dataSheet = workbook.addWorksheet('DataLists', { state: 'hidden' });

        // Fill data in hidden sheet
        positionNames.forEach((name, index) => {
            dataSheet.getCell(`A${index + 1}`).value = name;
        });
        branchNames.forEach((name, index) => {
            dataSheet.getCell(`B${index + 1}`).value = name;
        });

        // Add headers to main sheet
        const columns = [
            { header: 'Nombre', key: 'name', width: 40 },
            { header: 'Puesto', key: 'position', width: 25 },
        ];

        if (branches.length > 1) {
            columns.push({ header: 'Sucursal', key: 'branch', width: 25 });
        }

        columns.push(
            { header: 'Telefono', key: 'phone', width: 20 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Direccion', key: 'address', width: 50 },
            { header: 'Sueldo', key: 'salary', width: 15 }
        );

        sheet.columns = columns;

        // Format headers
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F2937' } // Dark gray matching theme
        };
        sheet.getRow(1).alignment = { horizontal: 'center' };

        // Add data validation for 500 rows
        const posRange = `'DataLists'!$A$1:$A$${positionNames.length}`;
        const branchRange = `'DataLists'!$B$1:$B$${branchNames.length}`;

        for (let i = 2; i <= 501; i++) {
            // Position dropdown (Always Column B)
            sheet.getCell(`B${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ["=" + posRange]
            };

            // Branch dropdown (Only if Column C is Sucursal)
            if (branches.length > 1) {
                sheet.getCell(`C${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: ["=" + branchRange]
                };
            }
        }

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="plantilla_empleados.xlsx"',
            },
        });

    } catch (error) {
        console.error('Error generating employee template:', error);
        return NextResponse.json({ success: false, message: 'Error generating template' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
