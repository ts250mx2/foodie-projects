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
            `SELECT v.*, t.Turno, ter.Terminal, ter.Comision,
                    (v.Venta * ter.Comision / 100) as ComisionMonto
             FROM tblVentasTerminales v
             JOIN tblTurnos t ON v.IdTurno = t.IdTurno
             JOIN tblTerminales ter ON v.IdTerminal = ter.IdTerminal
             WHERE v.IdSucursal = ? AND v.Dia = ? AND v.Mes = ? AND v.Anio = ?`,
            [branchIdStr, dayStr, monthStr, yearStr]
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching daily terminal sales:', error);
        return NextResponse.json({ success: false, message: 'Error fetching daily terminal sales' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, branchId, day, month, year, shiftId, terminalId, amount } = body;

        if (!projectId || !branchId || !shiftId || !terminalId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        // 1. Ensure columns and tables exist
        try {
            await connection.query(`ALTER TABLE tblVentasTerminales ADD COLUMN IdGasto INT DEFAULT NULL`);
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

        // 2. Get Terminal info for commission calculation
        const [terminalRows] = await connection.query(
            `SELECT Terminal, Comision FROM tblTerminales WHERE IdTerminal = ?`,
            [terminalId]
        ) as [RowDataPacket[], any];

        if (terminalRows.length === 0) {
            return NextResponse.json({ success: false, message: 'Terminal not found' }, { status: 404 });
        }

        const terminalName = terminalRows[0].Terminal;
        const commissionPct = terminalRows[0].Comision || 0;
        const commissionAmount = (parseFloat(amount) * commissionPct) / 100;

        // 3. Check for existing expense link
        const [existingSale] = await connection.query(
            `SELECT IdGasto FROM tblVentasTerminales 
             WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdTurno = ? AND IdTerminal = ? AND IdSucursal = ?`,
            [day, month, year, shiftId, terminalId, branchId]
        ) as [RowDataPacket[], any];

        let idGasto = existingSale.length > 0 ? existingSale[0].IdGasto : null;

        // 4. Handle Expense
        if (commissionAmount > 0) {
            const fechaVenta = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} 00:00:00`;
            const concepto = `PAGO COMISION ${terminalName}`;

            if (idGasto) {
                // Update existing expense
                await connection.query(
                    `UPDATE tblGastos SET Total = ?, FechaAct = Now(), ConceptoGasto = ? WHERE IdGasto = ?`,
                    [commissionAmount, concepto, idGasto]
                );
            } else {
                // Insert new expense
                const [resultGasto] = await connection.query(
                    `INSERT INTO tblGastos (IdProveedor, FechaGasto, Dia, Mes, Anio, IdConceptoGasto, Total, FechaAct, IdSucursal, ConceptoGasto, Status, NumeroFactura)
                     VALUES (-1, ?, ?, ?, ?, 0, ?, Now(), ?, ?, 0, '')`,
                    [fechaVenta, day, month + 1, year, commissionAmount, branchId, concepto]
                ) as [ResultSetHeader, any];
                idGasto = resultGasto.insertId;
            }
        } else if (idGasto) {
            // Delete expense if commission became 0
            await connection.query(`DELETE FROM tblGastos WHERE IdGasto = ?`, [idGasto]);
            idGasto = null;
        }

        // 5. Save/Update Sale with IdGasto link
        await connection.query(
            `INSERT INTO tblVentasTerminales (Dia, Mes, Anio, IdTurno, IdTerminal, IdSucursal, Venta, IdGasto, FechaAct)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, Now())
             ON DUPLICATE KEY UPDATE Venta = VALUES(Venta), IdGasto = VALUES(IdGasto), FechaAct = Now()`,
            [day, month, year, shiftId, terminalId, branchId, amount, idGasto]
        );

        return NextResponse.json({ success: true, message: 'Sale and commission expense saved successfully' });
    } catch (error) {
        console.error('Error saving terminal sale:', error);
        return NextResponse.json({ success: false, message: 'Error saving terminal sale' }, { status: 500 });
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
        const terminalIdStr = searchParams.get('terminalId');

        if (!projectIdStr || !branchIdStr || !dayStr || monthStr === null || !yearStr || !shiftIdStr || !terminalIdStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectIdStr));

        // 1. Fetch IdGasto before deleting
        const [saleRows] = await connection.query(
            `SELECT IdGasto FROM tblVentasTerminales
             WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdTurno = ? AND IdTerminal = ? AND IdSucursal = ?`,
            [dayStr, monthStr, yearStr, shiftIdStr, terminalIdStr, branchIdStr]
        ) as [RowDataPacket[], any];

        if (saleRows.length > 0 && saleRows[0].IdGasto) {
            // 2. Delete linked expense
            await connection.query(`DELETE FROM tblGastos WHERE IdGasto = ?`, [saleRows[0].IdGasto]);
        }

        // 3. Delete sale record
        await connection.query(
            `DELETE FROM tblVentasTerminales
             WHERE Dia = ? AND Mes = ? AND Anio = ? AND IdTurno = ? AND IdTerminal = ? AND IdSucursal = ?`,
            [dayStr, monthStr, yearStr, shiftIdStr, terminalIdStr, branchIdStr]
        );

        return NextResponse.json({ success: true, message: 'Sale and associated expense deleted successfully' });
    } catch (error) {
        console.error('Error deleting terminal sale:', error);
        return NextResponse.json({ success: false, message: 'Error deleting terminal sale' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

