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
        const monthNum = parseInt(monthStr) + 1; // 1-12 for tblGastos
        const year = parseInt(yearStr);

        connection = await getProjectConnection(projectId);

        // 1. Total Expenses
        const [totalExpenseRows] = (await connection.query(
            `SELECT SUM(Total) as total 
             FROM tblGastos 
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];
        const totalExpenses = totalExpenseRows[0]?.total || 0;

        // 2. Group by Concept
        const [conceptRows] = (await connection.query(
            `SELECT c.ConceptoGasto as name, SUM(g.Total) as value, COUNT(*) as count
             FROM tblGastos g
             LEFT JOIN tblConceptosGastos c ON g.IdConceptoGasto = c.IdConceptoGasto
             WHERE g.IdSucursal = ? AND g.Mes = ? AND g.Anio = ?
             GROUP BY c.ConceptoGasto`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // 3. Group by Provider
        const [providerRows] = (await connection.query(
            `SELECT COALESCE(p.Proveedor, 'Sin Proveedor') as name, SUM(g.Total) as value, COUNT(*) as count
             FROM tblGastos g
             LEFT JOIN tblProveedores p ON g.IdProveedor = p.IdProveedor
             WHERE g.IdSucursal = ? AND g.Mes = ? AND g.Anio = ?
             GROUP BY name`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];

        // 4. Group by Day
        const [dayRows] = (await connection.query(
            `SELECT CAST(Dia AS CHAR) as name, SUM(Total) as value, COUNT(*) as count
             FROM tblGastos
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?
             GROUP BY Dia
             ORDER BY Dia ASC`,
            [branchId, monthNum, year]
        )) as [RowDataPacket[], FieldPacket[]];

        return NextResponse.json({
            success: true,
            data: {
                concepts: conceptRows,
                providers: providerRows,
                days: dayRows,
                totalExpenses
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard expense details:', error);
        return NextResponse.json({ success: false, message: 'Error fetching dashboard expense details' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
