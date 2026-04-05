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
        const kpi = searchParams.get('kpi');
        const grouping = searchParams.get('grouping');
        const itemName = searchParams.get('itemName');

        if (!projectIdStr || !branchIdStr || monthStr === null || !yearStr || !kpi || !grouping || !itemName) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        const branchId = parseInt(branchIdStr);
        const year = parseInt(yearStr);

        let month = parseInt(monthStr);
        let monthNum = month + 1; // 1-12 for SQL

        connection = await getProjectConnection(projectId);
        let query = '';
        let params: any[] = [];

        if (kpi === 'sales') {
            params = [branchId, month, year, itemName];
            if (grouping === 'channels') {
                query = `SELECT CAST(v.Dia AS CHAR) as name, SUM(v.Venta) as value, COUNT(*) as count
                         FROM tblVentasCanalesVenta v JOIN tblCanalesVenta c ON v.IdCanalVenta = c.IdCanalVenta
                         WHERE v.IdSucursal = ? AND v.Mes = ? AND v.Anio = ? AND c.CanalVenta = ?
                         GROUP BY v.Dia ORDER BY v.Dia ASC`;
            } else if (grouping === 'shifts') {
                query = `SELECT CAST(v.Dia AS CHAR) as name, SUM(v.Venta) as value, COUNT(*) as count
                         FROM tblVentasCanalesVenta v JOIN tblTurnos t ON v.IdTurno = t.IdTurno
                         WHERE v.IdSucursal = ? AND v.Mes = ? AND v.Anio = ? AND t.Turno = ?
                         GROUP BY v.Dia ORDER BY v.Dia ASC`;
            } else if (grouping === 'payments') {
                if (itemName === 'Efectivo') {
                    return NextResponse.json({ success: true, data: [] });
                }
                query = `SELECT CAST(v.Dia AS CHAR) as name, SUM(v.Venta) as value, COUNT(*) as count
                         FROM tblVentasTerminales v JOIN tblTerminales ter ON v.IdTerminal = ter.IdTerminal
                         WHERE v.IdSucursal = ? AND v.Mes = ? AND v.Anio = ? AND ter.Terminal = ?
                         GROUP BY v.Dia ORDER BY v.Dia ASC`;
            }
        } else if (kpi === 'payroll') {
            params = [branchId, monthNum, year, itemName];
            if (grouping === 'positions') {
                query = `SELECT CAST(n.Dia AS CHAR) as name, SUM(n.Pago) as value, COUNT(DISTINCT n.IdUsuario) as count
                         FROM tblNomina n JOIN tblEmpleados e ON n.IdUsuario = e.IdEmpleado JOIN BDFoodieProjects.tblPuestos p ON e.IdPuesto = p.IdPuesto
                         WHERE n.IdSucursal = ? AND n.Mes = ? AND n.Anio = ? AND p.Puesto = ?
                         GROUP BY n.Dia ORDER BY n.Dia ASC`;
            } else if (grouping === 'employees') {
                query = `SELECT CAST(n.Dia AS CHAR) as name, SUM(n.Pago) as value, COUNT(*) as count
                         FROM tblNomina n JOIN tblEmpleados e ON n.IdUsuario = e.IdEmpleado
                         WHERE n.IdSucursal = ? AND n.Mes = ? AND n.Anio = ? AND e.Empleado = ?
                         GROUP BY n.Dia ORDER BY n.Dia ASC`;
            }
        } else if (kpi === 'expenses') {
            params = [branchId, monthNum, year, itemName];
            if (grouping === 'concepts') {
                query = `SELECT CAST(g.Dia AS CHAR) as name, SUM(g.Total) as value, COUNT(*) as count
                         FROM tblGastos g JOIN tblConceptosGastos c ON g.IdConceptoGasto = c.IdConceptoGasto
                         WHERE g.IdSucursal = ? AND g.Mes = ? AND g.Anio = ? AND c.ConceptoGasto = ?
                         GROUP BY g.Dia ORDER BY g.Dia ASC`;
            } else if (grouping === 'providers') {
                if (itemName === 'Sin Proveedor') {
                    query = `SELECT CAST(g.Dia AS CHAR) as name, SUM(g.Total) as value, COUNT(*) as count
                             FROM tblGastos g 
                             WHERE g.IdSucursal = ? AND g.Mes = ? AND g.Anio = ? AND g.IdProveedor IS NULL
                             GROUP BY g.Dia ORDER BY g.Dia ASC`;
                    params = [branchId, monthNum, year];
                } else {
                    query = `SELECT CAST(g.Dia AS CHAR) as name, SUM(g.Total) as value, COUNT(*) as count
                             FROM tblGastos g JOIN tblProveedores p ON g.IdProveedor = p.IdProveedor
                             WHERE g.IdSucursal = ? AND g.Mes = ? AND g.Anio = ? AND p.Proveedor = ?
                             GROUP BY g.Dia ORDER BY g.Dia ASC`;
                }
            }
        } else if (kpi === 'purchases') {
            params = [branchId, monthNum, year, itemName];
            if (grouping === 'categories') {
                query = `SELECT DAY(co.FechaCompra) as name, SUM(d.Cantidad * d.Costo) as value, COUNT(DISTINCT co.IdCompra) as count
                         FROM tblCompras co
                         JOIN tblDetalleCompras d ON co.IdCompra = d.IdCompra
                         JOIN tblProductos p ON d.IdProducto = p.IdProducto
                         LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
                         WHERE co.IdSucursal = ? AND MONTH(co.FechaCompra) = ? AND YEAR(co.FechaCompra) = ? AND co.Status != 2 AND c.Categoria = ?
                         GROUP BY DAY(co.FechaCompra) ORDER BY DAY(co.FechaCompra) ASC`;
            } else if (grouping === 'providers') {
                query = `SELECT DAY(co.FechaCompra) as name, SUM(co.Total) as value, COUNT(co.IdCompra) as count
                         FROM tblCompras co JOIN tblProveedores p ON co.IdProveedor = p.IdProveedor
                         WHERE co.IdSucursal = ? AND MONTH(co.FechaCompra) = ? AND YEAR(co.FechaCompra) = ? AND co.Status != 2 AND p.Proveedor = ?
                         GROUP BY DAY(co.FechaCompra) ORDER BY DAY(co.FechaCompra) ASC`;
            } else if (grouping === 'products') {
                query = `SELECT DAY(co.FechaCompra) as name, SUM(d.Cantidad * d.Costo) as value, COUNT(DISTINCT co.IdCompra) as count
                         FROM tblCompras co
                         JOIN tblDetalleCompras d ON co.IdCompra = d.IdCompra
                         JOIN tblProductos p ON d.IdProducto = p.IdProducto
                         WHERE co.IdSucursal = ? AND MONTH(co.FechaCompra) = ? AND YEAR(co.FechaCompra) = ? AND co.Status != 2 AND p.Producto = ?
                         GROUP BY DAY(co.FechaCompra) ORDER BY DAY(co.FechaCompra) ASC`;
            }
        } else if (kpi === 'waste') {
            params = [branchId, monthNum, year, itemName];
            if (grouping === 'categories') {
                query = `SELECT m.Dia as name, SUM(m.Cantidad * m.Precio) as value, COUNT(m.IdProducto) as count
                         FROM tblMermas m
                         JOIN tblProductos p ON m.IdProducto = p.IdProducto
                         LEFT JOIN BDFoodieProjects.tblCategorias c ON p.IdCategoria = c.IdCategoria
                         WHERE m.IdSucursal = ? AND m.Mes = ? AND m.Anio = ? AND c.Categoria = ?
                         GROUP BY m.Dia ORDER BY m.Dia ASC`;
            } else if (grouping === 'products') {
                query = `SELECT m.Dia as name, SUM(m.Cantidad * m.Precio) as value, COUNT(*) as count
                         FROM tblMermas m
                         JOIN tblProductos p ON m.IdProducto = p.IdProducto
                         WHERE m.IdSucursal = ? AND m.Mes = ? AND m.Anio = ? AND p.Producto = ?
                         GROUP BY m.Dia ORDER BY m.Dia ASC`;
            }
        }

        if (!query) {
            return NextResponse.json({ success: true, data: [] });
        }

        const [rows] = (await connection.query(query, params)) as [RowDataPacket[], FieldPacket[]];

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching drilldown details:', error);
        return NextResponse.json({ success: false, message: 'Error fetching drilldown details' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
