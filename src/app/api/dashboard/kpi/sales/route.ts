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
        const payrollStartDate = searchParams.get('payrollStartDate');
        const payrollEndDate = searchParams.get('payrollEndDate');

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
        // We use the payroll month for payroll objective if specified, otherwise the global month
        let targetMonth = month + 1;
        if (payrollStartDate) {
            const startDate = new Date(payrollStartDate);
            targetMonth = startDate.getMonth() + 1;
        }

        const [targetRows] = (await connection.query(
            `SELECT ObjetivoVentas as salesObjective, 
                    CostoNomina as payrollObjective,
                    GastoOperativo as operatingExpenseObjective,
                    CostoMateriaPrima as rawMaterialObjective
             FROM tblSucursalesCostos 
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchId, targetMonth, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // Payroll: tblNomina uses 1-12 for Mes index. Sum of 'Pago' column as requested.
        let payrollWhere = `IdSucursal = ? AND Mes = ? AND Anio = ?`;
        let payrollParams: (number | string)[] = [branchId, month + 1, year];

        if (payrollStartDate && payrollEndDate) {
            payrollWhere = `IdSucursal = ? AND DATE(CONCAT(Anio, '-', Mes, '-', Dia)) BETWEEN ? AND ?`;
            payrollParams = [branchId, payrollStartDate, payrollEndDate];
        }

        const [payrollRows] = (await connection.query(
            `SELECT SUM(Pago) as totalPayroll 
             FROM tblNomina 
             WHERE ${payrollWhere}`,
            payrollParams
        )) as [RowDataPacket[], FieldPacket[]];

        // Expenses: tblGastos uses 1-12 for Mes index. Sum of 'Gasto' column.
        const [expenseRows] = (await connection.query(
            `SELECT SUM(Total) as totalOperatingExpense 
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

        // Waste: tblMermas uses 1-12 for Mes index
        const [wasteRows] = (await connection.query(
            `SELECT SUM(Cantidad * Precio) as totalWaste 
             FROM tblMermas 
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchId, month + 1, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // Latest Inventory: Get the most recent inventory cost and date (only if > 0)
        // Use the same logic as drill-down for consistency: COALESCE(v.CostoInventario, I.Precio)
        const [inventoryRows] = (await connection.query(
            `SELECT SUM(I.Cantidad * COALESCE(v.CostoInventario, I.Precio)) as lastInventoryCost, 
                    MAX(DATE(CONCAT(I.Anio, '-', I.Mes, '-', I.Dia))) as lastInventoryDate,
                    I.Anio, I.Mes, I.Dia
             FROM tblInventarios I
             LEFT JOIN vlProductos v ON I.IdProducto = v.IdProducto
             WHERE I.IdSucursal = ?
             GROUP BY I.Anio, I.Mes, I.Dia 
             HAVING lastInventoryCost > 0
             ORDER BY I.Anio DESC, I.Mes DESC, I.Dia DESC 
             LIMIT 1`,
            [branchId]
        )) as [RowDataPacket[], FieldPacket[]];

        const totalSales = salesRows[0]?.totalSales || 0;
        const salesObjective = targetRows[0]?.salesObjective || 0;

        const totalPayroll = payrollRows[0]?.totalPayroll || 0;
        const payrollObjective = targetRows[0]?.payrollObjective || 0;

        const totalOperatingExpense = expenseRows[0]?.totalOperatingExpense || 0;
        const operatingExpenseObjective = targetRows[0]?.operatingExpenseObjective || 0;

        const totalRawMaterial = purchaseRows[0]?.totalRawMaterial || 0;
        const rawMaterialObjective = targetRows[0]?.rawMaterialObjective || 0;

        const totalWaste = wasteRows[0]?.totalWaste || 0;

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
                rawMaterialObjective,
                totalWaste,
                lastInventoryCost: inventoryRows[0]?.lastInventoryCost || 0,
                lastInventoryDate: inventoryRows[0]?.lastInventoryDate || null,
                lastInventoryDay: inventoryRows[0]?.Dia || null,
                lastInventoryMonth: inventoryRows[0]?.Mes ? inventoryRows[0].Mes - 1 : null, // Convert to 0-11 for consistency
                lastInventoryYear: inventoryRows[0]?.Anio || null
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard sales KPI:', error);
        return NextResponse.json({ success: false, message: 'Error fetching dashboard sales KPI' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
