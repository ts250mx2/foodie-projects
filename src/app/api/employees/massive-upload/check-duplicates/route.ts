import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';

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

        // Fetch existing employees to check for duplicates
        const [employees] = await connection.query(
            'SELECT Empleado as name FROM tblEmpleados WHERE Status = 0'
        ) as any[];

        // Fetch positions for validation
        const [positions] = await connection.query(
            'SELECT Puesto as name FROM BDFoodieProjects.tblPuestos WHERE Status = 0'
        ) as any[];

        // Fetch branches for validation
        const [branches] = await connection.query(
            'SELECT Sucursal as name FROM tblSucursales WHERE Status = 0'
        ) as any[];

        return NextResponse.json({
            success: true,
            employees: employees.map((e: any) => e.name),
            positions: positions.map((p: any) => p.name),
            branches: branches.map((b: any) => b.name)
        });

    } catch (error) {
        console.error('Error fetching data for massive employee upload check:', error);
        return NextResponse.json({ success: false, message: 'Error fetching validation data' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
