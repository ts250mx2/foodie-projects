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
        const date = searchParams.get('date');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        let query = `
            SELECT h.*, e.Empleado, p.Puesto
            FROM tblHorarios h
            JOIN tblEmpleados e ON h.IdEmpleado = e.IdEmpleado
            LEFT JOIN tblPuestos p ON e.IdPuesto = p.IdPuesto
            WHERE 0 = 0
        `;
        const queryParams: any[] = [];

        if (startDate && endDate) {
            query += ` AND h.Fecha BETWEEN ? AND ? `;
            queryParams.push(startDate, endDate);
        } else if (date) {
            query += ` AND h.Fecha = ? `;
            queryParams.push(date);
        } else if (month && year) {
            query += ` AND MONTH(h.Fecha) = ? AND YEAR(h.Fecha) = ? `;
            queryParams.push(parseInt(month) + 1, parseInt(year));
        }

        if (branchIdStr) {
            query += ` AND h.IdSucursal = ? `;
            queryParams.push(parseInt(branchIdStr));
        }

        const employeeIdStr = searchParams.get('employeeId');
        if (employeeIdStr) {
            query += ` AND h.IdEmpleado = ? `;
            queryParams.push(parseInt(employeeIdStr));
        }

        query += ` ORDER BY h.Fecha ASC, h.FechaAct DESC `;

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
        const { projectId, employeeId, employeeIds, branchId, date, startTime, endTime, breakStartTime, breakEndTime, bulk } = body;

        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Missing project ID' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        await connection.beginTransaction();

        const query = `
            INSERT INTO tblHorarios (IdEmpleado, IdSucursal, Fecha, HoraInicio, HoraFin, HoraInicioDescanso, HoraFinDescanso, FechaAct)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
            IdSucursal = VALUES(IdSucursal),
            HoraInicio = VALUES(HoraInicio),
            HoraFin = VALUES(HoraFin),
            HoraInicioDescanso = VALUES(HoraInicioDescanso),
            HoraFinDescanso = VALUES(HoraFinDescanso),
            FechaAct = NOW()
        `;

        if (bulk && Array.isArray(bulk)) {
            for (const item of bulk) {
                await connection.query(query, [
                    item.employeeId,
                    item.branchId,
                    item.date,
                    item.startTime || null,
                    item.endTime || null,
                    item.breakStartTime || null,
                    item.breakEndTime || null
                ]);
            }
        } else {
            if ((!employeeId && !employeeIds) || !date || !branchId) {
                await connection.rollback();
                return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
            }
            const idsToProcess = employeeIds && Array.isArray(employeeIds) ? employeeIds : [employeeId];
            for (const id of idsToProcess) {
                await connection.query(query, [
                    id,
                    branchId,
                    date,
                    startTime || null,
                    endTime || null,
                    breakStartTime || null,
                    breakEndTime || null
                ]);
            }
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: 'Schedules saved successfully'
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error saving schedule:', error);
        return NextResponse.json({ success: false, message: 'Error saving schedule' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        const id = searchParams.get('id');
        const employeeIdStr = searchParams.get('employeeId');
        const date = searchParams.get('date');

        if (!projectIdStr || (!id && (!employeeIdStr || !date))) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        if (id) {
            await connection.query(
                'DELETE FROM tblHorarios WHERE IdHorario = ?',
                [parseInt(id)]
            );
        } else {
            const employeeId = parseInt(employeeIdStr!);
            await connection.query(
                'DELETE FROM tblHorarios WHERE IdEmpleado = ? AND Fecha = ?',
                [employeeId, date]
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Schedule deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        return NextResponse.json({ success: false, message: 'Error deleting schedule' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
