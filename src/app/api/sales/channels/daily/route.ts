import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const dayStr = searchParams.get('day');
        const monthStr = searchParams.get('month');
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || !dayStr || monthStr === null || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        const [rows] = await connection.query(
            `SELECT v.*, t.Turno, c.CanalVenta, c.Comision
             FROM tblVentasCanalesVenta v
             JOIN tblTurnos t ON v.IdTurno = t.IdTurno
             JOIN tblCanalesVenta c ON v.IdCanalVenta = c.IdCanalVenta
             WHERE v.IdSucursal = ? AND v.Dia = ? AND v.Mes = ? AND v.Anio = ?`,
            [branchIdStr, dayStr, monthStr, yearStr]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching daily channel sales:', error);
        return NextResponse.json({ success: false, message: 'Error fetching daily channel sales' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, day, month, year, shiftId, channelId, amount } = body;

        if (!projectId || !branchId || !shiftId || !channelId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        // 1. Ensure columns and tables exist
        try {
            await connection.query(`ALTER TABLE tblVentasCanalesVenta ADD COLUMN IdGasto INT DEFAULT NULL`);
        } catch (e) {
            // Ignore error if column already exists
        }

        await connection.query(`
            CREATE TABLE IF NOT EXISTS tblGastos (
                IdGasto INT AUTO_INCREMENT PRIMARY KEY,
                IdProveedor INT DEFAULT -1,
                FechaGasto DATETIME,
                Dia INT,
                Mes INT,
                Anio INT,
                IdConceptoGasto INT DEFAULT 0,
                Total DECIMAL(10,2),
                FechaAct DATETIME,
                IdSucursal INT,
                ConceptoGasto VARCHAR(255),
                Status INT DEFAULT 0,
                NumeroFactura VARCHAR(50) DEFAULT ''
            )
        `);

        // 2. Get Channel and Branch info
        const [channelRows] = await connection.query(
            `SELECT CanalVenta, Comision FROM tblCanalesVenta WHERE IdCanalVenta = ?`,
            [channelId]
        ) as [RowDataPacket[], any];

        if (channelRows.length === 0) {
            return NextResponse.json({ success: false, message: 'Sales channel not found' }, { status: 404 });
        }

        const [branchRows] = await connection.query(
            `SELECT B.Impuesto AS ImpuestoDefault FROM tblSucursales A INNER JOIN tblImpuestos B ON A.ImpuestoDefault = B.IdImpuesto WHERE A.IdSucursal = ?`,
            [branchId]
        ) as [RowDataPacket[], any];

        const channelName = channelRows[0].CanalVenta;
        const commissionPct = channelRows[0].Comision || 0;
        const branchTaxPct = branchRows.length > 0 ? (branchRows[0].ImpuestoDefault || 0) : 0;

        let expenseAmount = 0;
        let expenseConcept = '';

        if (commissionPct > 0) {
            expenseAmount = (parseFloat(amount) * commissionPct) / 100;
            expenseConcept = `PAGO COMISION ${channelName}`;
        } else {
            expenseAmount = (parseFloat(amount) * branchTaxPct) / 100;
            expenseConcept = `PAGO IMPUESTO ${channelName}`;
        }

        // 3. Check for existing expense link
        const [existingSale] = await connection.query(
            `SELECT IdGasto FROM tblVentasCanalesVenta 
             WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdTurno = ? AND IdCanalVenta = ? AND IdSucursal = ?`,
            [day, month, year, shiftId, channelId, branchId]
        ) as [RowDataPacket[], any];

        let idGasto = existingSale.length > 0 ? existingSale[0].IdGasto : null;

        // 4. Handle Expense (using IdProveedor = -2 for Sales Channels)
        const fechaVenta = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} 00:00:00`;

        if (expenseAmount > 0) {
            if (idGasto) {
                // Update existing expense
                console.log('Updating expense for Sales Channel:', { idGasto, expenseAmount, expenseConcept });
                await connection.query(
                    `UPDATE tblGastos SET Total = ?, FechaAct = Now(), ConceptoGasto = ?, IdProveedor = -2 WHERE IdGasto = ?`,
                    [expenseAmount, expenseConcept, idGasto]
                );
            } else {
                // Insert new expense
                console.log('Inserting new expense for Sales Channel:', { expenseAmount, expenseConcept, branchId });
                const [resultGasto] = await connection.query(
                    `INSERT INTO tblGastos (IdProveedor, FechaGasto, Dia, Mes, Anio, IdConceptoGasto, Total, FechaAct, IdSucursal, ConceptoGasto, Status, NumeroFactura)
                     VALUES (-2, ?, ?, ?, ?, 0, ?, Now(), ?, ?, 0, '')`,
                    [fechaVenta, day, month + 1, year, expenseAmount, branchId, expenseConcept]
                ) as [ResultSetHeader, any];
                idGasto = resultGasto.insertId;
            }
        } else if (idGasto) {
            // Delete expense if amount became 0
            await connection.query(`DELETE FROM tblGastos WHERE IdGasto = ?`, [idGasto]);
            idGasto = null;
        }

        // 5. Save/Update Sale with IdGasto link
        await connection.query(
            `INSERT INTO tblVentasCanalesVenta (Dia, Mes, Anio, IdTurno, IdCanalVenta, IdSucursal, Venta, IdGasto, FechaAct)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, Now())
             ON DUPLICATE KEY UPDATE Venta = VALUES(Venta), IdGasto = VALUES(IdGasto), FechaAct = Now()`,
            [day, month, year, shiftId, channelId, branchId, amount, idGasto]
        );

        return NextResponse.json({ success: true, message: 'Sale and associated expense saved successfully' });
    } catch (error) {
        console.error('Error saving channel sale:', error);
        return NextResponse.json({ success: false, message: 'Error saving channel sale' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const dayStr = searchParams.get('day');
        const monthStr = searchParams.get('month');
        const yearStr = searchParams.get('year');
        const shiftIdStr = searchParams.get('shiftId');
        const channelIdStr = searchParams.get('channelId');

        if (!projectIdStr || !branchIdStr || !dayStr || monthStr === null || !yearStr || !shiftIdStr || !channelIdStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        // 1. Fetch IdGasto before deleting
        const [saleRows] = await connection.query(
            `SELECT IdGasto FROM tblVentasCanalesVenta
             WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdTurno = ? AND IdCanalVenta = ? AND IdSucursal = ?`,
            [dayStr, monthStr, yearStr, shiftIdStr, channelIdStr, branchIdStr]
        ) as [RowDataPacket[], any];

        if (saleRows.length > 0 && saleRows[0].IdGasto) {
            // 2. Delete linked expense
            await connection.query(`DELETE FROM tblGastos WHERE IdGasto = ?`, [saleRows[0].IdGasto]);
        }

        // 3. Delete sale record
        await connection.query(
            `DELETE FROM tblVentasCanalesVenta
             WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdTurno = ? AND IdCanalVenta = ? AND IdSucursal = ?`,
            [dayStr, monthStr, yearStr, shiftIdStr, channelIdStr, branchIdStr]
        );

        return NextResponse.json({ success: true, message: 'Sale and associated expense deleted successfully' });
    } catch (error) {
        console.error('Error deleting channel sale:', error);
        return NextResponse.json({ success: false, message: 'Error deleting channel sale' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

