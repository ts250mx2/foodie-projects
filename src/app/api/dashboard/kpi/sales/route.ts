import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, FieldPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const monthStr = searchParams.get('month'); // 0-11
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || monthStr === null || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const month = parseInt(monthStr); // 0-11
        const year = parseInt(yearStr);

        connection = await getProjectConnection(projectId);

        // Sales: tblVentasCanalesVenta uses 0-11 for Mes index
        const [salesRows] = (await connection.query(
            `SELECT SUM(Venta) as totalSales 
             FROM tblVentasCanalesVenta 
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchId, month, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // Objectives and Targets: tblSucursalesCostos uses 1-12 for Mes index
        const [targetRows] = (await connection.query(
            `SELECT ObjetivoVentas as salesObjective, 
                    CostoNomina as payrollObjective,
                    GastoOperativo as operatingExpenseObjective,
                    CostoMateriaPrima as rawMaterialObjective
             FROM tblSucursalesCostos 
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchId, month + 1, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // Payroll: tblNomina uses 1-12 for Mes index. Sum of 'Pago' column as requested.
        const [payrollRows] = (await connection.query(
            `SELECT SUM(Pago) as totalPayroll 
             FROM tblNomina 
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchId, month + 1, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // Expenses: tblGastos uses 1-12 for Mes index. Sum of 'Gasto' column.
        const [expenseRows] = (await connection.query(
            `SELECT SUM(Gasto) as totalOperatingExpense 
             FROM tblGastos 
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchId, month + 1, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // Raw Materials: tblCompras uses FechaCompra. MONTH() returns 1-12.
        const [purchaseRows] = (await connection.query(
            `SELECT SUM(Total) as totalRawMaterial 
             FROM tblCompras 
             WHERE IdSucursal = ? AND MONTH(FechaCompra) = ? AND YEAR(FechaCompra) = ? AND Status != 2`,
            [branchId, month + 1, year]
        )) as [RowDataPacket[], FieldPacket[]];

        const totalSales = salesRows[0]?.totalSales || 0;
        const salesObjective = targetRows[0]?.salesObjective || 0;

        const totalPayroll = payrollRows[0]?.totalPayroll || 0;
        const payrollObjective = targetRows[0]?.payrollObjective || 0;

        const totalOperatingExpense = expenseRows[0]?.totalOperatingExpense || 0;
        const operatingExpenseObjective = targetRows[0]?.operatingExpenseObjective || 0;

        const totalRawMaterial = purchaseRows[0]?.totalRawMaterial || 0;
        const rawMaterialObjective = targetRows[0]?.rawMaterialObjective || 0;

        return NextResponse.json({
            success: true,
            data: {
                totalSales,
                salesObjective,
                totalPayroll,
                payrollObjective,
                totalOperatingExpense,
                operatingExpenseObjective,
                totalRawMaterial,
                rawMaterialObjective
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard sales KPI:', error);
        return NextResponse.json({ success: false, message: 'Error fetching dashboard sales KPI' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
