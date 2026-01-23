import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const branchIdStr = searchParams.get('branchId');
        const month = searchParams.get('month');
        const year = searchParams.get('year');
        const date = searchParams.get('date'); // Optional specific date YYYY-MM-DD

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        let query = `
            SELECT h.*, e.Empleado, p.Puesto
            FROM tblHorariosEmpleados h
            JOIN tblEmpleados e ON h.IdEmpleado = e.IdEmpleado
            LEFT JOIN tblPuestos p ON e.IdPuesto = p.IdPuesto
            WHERE h.Status = 0
        `;
        const queryParams: any[] = [];

        if (date) {
            query += ` AND h.Fecha = ? `;
            queryParams.push(date);
        } else if (month && year) {
            query += ` AND MONTH(h.Fecha) = ? AND YEAR(h.Fecha) = ? `;
            queryParams.push(parseInt(month) + 1, parseInt(year));
        }

        if (branchIdStr) {
            query += ` AND e.IdSucursal = ? `;
            queryParams.push(parseInt(branchIdStr));
        }

        query += ` ORDER BY h.Fecha ASC, h.HoraInicio ASC `;

        const [rows] = await connection.query(query, queryParams);

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching schedules:', error);
        return NextResponse.json({ success: false, message: 'Error fetching schedules' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { projectId, employeeId, date, startTime, endTime, breakStartTime, breakEndTime } = body;

        if (!projectId || !employeeId || !date) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);

        // Check if schedule already exists for this employee and date
        const [existing] = await connection.query(
            'SELECT IdHorarioEmpleado FROM tblHorariosEmpleados WHERE IdEmpleado = ? AND Fecha = ? AND Status = 0',
            [employeeId, date]
        );

        if (existing.length > 0) {
            // Update existing
            await connection.query(
                `UPDATE tblHorariosEmpleados 
                 SET HoraInicio = ?, HoraFin = ?, HoraInicioDescanso = ?, HoraFinDescanso = ?, FechaAct = Now()
                 WHERE IdHorarioEmpleado = ?`,
                [startTime || null, endTime || null, breakStartTime || null, breakEndTime || null, existing[0].IdHorarioEmpleado]
            );

            return NextResponse.json({
                success: true,
                message: 'Schedule updated successfully',
                id: existing[0].IdHorarioEmpleado
            });
        } else {
            // Insert new
            const [result] = await connection.query(
                `INSERT INTO tblHorariosEmpleados (IdEmpleado, Fecha, HoraInicio, HoraFin, HoraInicioDescanso, HoraFinDescanso, FechaAct, Status) 
                 VALUES (?, ?, ?, ?, ?, ?, Now(), 0)`,
                [employeeId, date, startTime || null, endTime || null, breakStartTime || null, breakEndTime || null]
            );

            return NextResponse.json({
                success: true,
                message: 'Schedule created successfully',
                id: result.insertId
            });
        }
    } catch (error) {
        console.error('Error saving schedule:', error);
        return NextResponse.json({ success: false, message: 'Error saving schedule' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

