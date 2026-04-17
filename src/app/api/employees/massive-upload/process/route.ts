import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, employees } = body;

        if (!projectId || !employees || !Array.isArray(employees)) {
            return NextResponse.json({ success: false, message: 'Invalid data' }, { status: 400 });
        }

        if (employees.length === 0) {
            return NextResponse.json({ success: true, message: 'No employees to process', count: 0 });
        }

        connection = await getProjectConnection(projectId);

        // Fetch IDs for positions from global table
        const [positions] = await connection.query(
            'SELECT IdPuesto, Puesto FROM BDFoodieProjects.tblPuestos WHERE Status = 0'
        ) as [RowDataPacket[], any];

        // Fetch IDs for branches from project table
        const [branches] = await connection.query(
            'SELECT IdSucursal, Sucursal FROM tblSucursales WHERE Status = 0'
        ) as [RowDataPacket[], any];

        // Create mapping objects
        const positionMap = new Map<string, number>();
        positions.forEach(p => {
            if (p.Puesto) positionMap.set(p.Puesto.toLowerCase().trim(), p.IdPuesto);
        });

        const branchMap = new Map<string, number>();
        branches.forEach(b => {
            if (b.Sucursal) branchMap.set(b.Sucursal.toLowerCase().trim(), b.IdSucursal);
        });

        // Current date for FechaAct
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Start transaction
        await connection.beginTransaction();

        let insertedCount = 0;
        for (const emp of employees) {
            const name = emp.Nombre || null;
            if (!name) continue;

            const positionName = (emp.Puesto || '').toLowerCase().trim();
            const branchName = (emp.Sucursal || '').toLowerCase().trim();

            const positionId = positionMap.get(positionName) || null;
            let branchId = branchMap.get(branchName) || null;

            // If only one branch exists, assign it by default
            if (branches.length === 1) {
                branchId = branches[0].IdSucursal;
            }

            const phone = emp.Telefono || null;
            const email = emp.Email || null;
            const address = emp.Direccion || null;
            const salary = parseFloat(emp.Sueldo) || 0;

            await connection.query(
                `INSERT INTO tblEmpleados 
                 (Empleado, IdPuesto, IdSucursal, Telefonos, CorreoElectronico, Calle, Sueldo, Status, FechaAct) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
                [name, positionId, branchId, phone, email, address, salary, now]
            );
            insertedCount++;
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: `Se han insertado ${insertedCount} empleados correctamente.`,
            count: insertedCount
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error processing massive employee upload:', error);
        return NextResponse.json({ success: false, message: 'Error procesando la carga masiva' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
