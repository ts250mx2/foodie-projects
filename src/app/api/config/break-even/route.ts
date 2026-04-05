import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const monthStr = searchParams.get('month');
        const yearStr = searchParams.get('year');

        if (!projectIdStr || !branchIdStr || !monthStr || !yearStr) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        // Ensure tables exist
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblPuntoEquilibrio\` (
                \`IdSucursal\` int NOT NULL,
                \`Mes\` int NOT NULL,
                \`Anio\` int NOT NULL,
                \`PrecioTicket\` double DEFAULT 0,
                \`VolumenTickets\` double DEFAULT 0,
                \`CostoMateriaPrima\` double DEFAULT 0,
                \`Empaque\` double DEFAULT 0,
                \`Otros\` double DEFAULT 0,
                \`Envio\` double DEFAULT 0,
                \`FechaAct\` datetime DEFAULT NULL,
                PRIMARY KEY (\`IdSucursal\`,\`Mes\`,\`Anio\`)
            ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblPuntoEquilibrioGastos\` (
                \`IdGasto\` int NOT NULL AUTO_INCREMENT,
                \`IdSucursal\` int NOT NULL,
                \`Mes\` int NOT NULL,
                \`Anio\` int NOT NULL,
                \`ConceptoGasto\` varchar(255) DEFAULT NULL,
                \`Monto\` double DEFAULT 0,
                \`FechaAct\` datetime DEFAULT NULL,
                PRIMARY KEY (\`IdGasto\`)
            ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblPuntoEquilibrioEscenarios\` (
                \`IdSucursal\` int NOT NULL,
                \`Mes\` int NOT NULL,
                \`Anio\` int NOT NULL,
                \`IdEscenario\` int NOT NULL,
                \`PrecioTicket\` double DEFAULT 0,
                \`VolumenTickets\` double DEFAULT 0,
                \`FechaAct\` datetime DEFAULT NULL,
                PRIMARY KEY (\`IdSucursal\`,\`Mes\`,\`Anio\`,\`IdEscenario\`)
            ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
        `);

        // Fetch main parameters
        const [rows] = await connection.query(
            `SELECT * FROM tblPuntoEquilibrio 
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchIdStr, monthStr, yearStr]
        );

        // Fetch fixed expenses
        const [expenseRows] = await connection.query(
            `SELECT ConceptoGasto, Monto FROM tblPuntoEquilibrioGastos 
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchIdStr, monthStr, yearStr]
        );

        // Fetch scenarios
        const [scenarioRows] = await connection.query(
            `SELECT IdEscenario, PrecioTicket, VolumenTickets FROM tblPuntoEquilibrioEscenarios 
             WHERE IdSucursal = ? AND Mes = ? AND Anio = ? ORDER BY IdEscenario`,
            [branchIdStr, monthStr, yearStr]
        );

        const mainData = (rows as RowDataPacket[])[0] || null;

        return NextResponse.json({ 
            success: true, 
            data: {
                ...(mainData || {}),
                fixedExpenses: expenseRows,
                scenarios: scenarioRows
            }
        });
    } catch (error) {
        console.error('Error fetching break-even data:', error);
        return NextResponse.json({ success: false, message: 'Error fetching break-even data' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { 
            projectId, branchId, month, year, 
            price, volume, rawMaterial, packaging, others, shipping,
            fixedExpenses, scenarios
        } = body;

        if (!projectId || !branchId || !month || !year) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        // Ensure tables exist
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblPuntoEquilibrio\` (
                \`IdSucursal\` int NOT NULL,
                \`Mes\` int NOT NULL,
                \`Anio\` int NOT NULL,
                \`PrecioTicket\` double DEFAULT 0,
                \`VolumenTickets\` double DEFAULT 0,
                \`CostoMateriaPrima\` double DEFAULT 0,
                \`Empaque\` double DEFAULT 0,
                \`Otros\` double DEFAULT 0,
                \`Envio\` double DEFAULT 0,
                \`FechaAct\` datetime DEFAULT NULL,
                PRIMARY KEY (\`IdSucursal\`,\`Mes\`,\`Anio\`)
            ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblPuntoEquilibrioEscenarios\` (
                \`IdSucursal\` int NOT NULL,
                \`Mes\` int NOT NULL,
                \`Anio\` int NOT NULL,
                \`IdEscenario\` int NOT NULL,
                \`PrecioTicket\` double DEFAULT 0,
                \`VolumenTickets\` double DEFAULT 0,
                \`FechaAct\` datetime DEFAULT NULL,
                PRIMARY KEY (\`IdSucursal\`,\`Mes\`,\`Anio\`,\`IdEscenario\`)
            ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
        `);

        // Save main parameters
        await connection.query(
            `REPLACE INTO tblPuntoEquilibrio (IdSucursal, Mes, Anio, PrecioTicket, VolumenTickets, CostoMateriaPrima, Empaque, Otros, Envio, FechaAct)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, Now())`,
            [branchId, month, year, price || 0, volume || 0, rawMaterial || 0, packaging || 0, others || 0, shipping || 0]
        );

        // Manage fixed expenses
        await connection.query(
            `DELETE FROM tblPuntoEquilibrioGastos WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchId, month, year]
        );

        if (fixedExpenses && Array.isArray(fixedExpenses) && fixedExpenses.length > 0) {
            const values = fixedExpenses.map((exp: any) => [
                branchId, month, year, exp.ConceptoGasto, exp.Monto || 0, new Date()
            ]);
            await connection.query(
                `INSERT INTO tblPuntoEquilibrioGastos (IdSucursal, Mes, Anio, ConceptoGasto, Monto, FechaAct) VALUES ?`,
                [values]
            );
        }

        // Manage scenarios
        await connection.query(
            `DELETE FROM tblPuntoEquilibrioEscenarios WHERE IdSucursal = ? AND Mes = ? AND Anio = ?`,
            [branchId, month, year]
        );

        if (scenarios && Array.isArray(scenarios) && scenarios.length > 0) {
            const scenarioValues = scenarios.map((s: any, idx: number) => [
                branchId, month, year, s.IdEscenario || (idx + 1), s.PrecioTicket || 0, s.VolumenTickets || 0, new Date()
            ]);
            await connection.query(
                `INSERT INTO tblPuntoEquilibrioEscenarios (IdSucursal, Mes, Anio, IdEscenario, PrecioTicket, VolumenTickets, FechaAct) VALUES ?`,
                [scenarioValues]
            );
        }

        return NextResponse.json({ success: true, message: 'Break-even data saved successfully' });
    } catch (error) {
        console.error('Error saving break-even data:', error);
        return NextResponse.json({ success: false, message: 'Error saving break-even data' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
