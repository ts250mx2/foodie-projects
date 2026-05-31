import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getProjectConnection } from '@/lib/dynamic-db';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface SummaryRequest {
    projectId: number;
    branchId: string;
    month: number;   // 0-indexed (JS)
    year: number;
    branchName?: string;
}

async function fetchMetrics(connection: any, branchId: string, month: number, year: number) {
    const mes = month + 1; // 1-indexed for DB

    const run = async (sql: string): Promise<any[]> => {
        try {
            const [rows] = await connection.execute(sql);
            return rows as any[];
        } catch (e: any) {
            console.error('Metric query error:', e.message, '|', sql);
            return [];
        }
    };

    const [
        canalesRows,        // total ventas por canal de venta
        terminalesRows,     // total ventas por forma de pago
        turnosCanalesRows,  // ventas por turno (desde canales)
        nominaRows,
        gastosRows,
        comprasRows,
        topGastosRows,
        topProvRows,
        empleadosRows,
        objetivoRows,
        mesAnteriorCanalesRows,
        mesAnteriorTerminalesRows,
    ] = await Promise.all([
        // ── Ventas por canal (Rappi, Uber, local, etc.) ──
        run(`SELECT c.CanalVenta AS canal, COALESCE(SUM(v.Venta),0) AS venta, c.Comision AS comision
             FROM tblVentasCanalesVenta v
             JOIN tblCanalesVenta c ON v.IdCanalVenta = c.IdCanalVenta
             WHERE v.IdSucursal = ${branchId} AND v.Mes = ${mes} AND v.Anio = ${year}
             GROUP BY c.IdCanalVenta, c.CanalVenta, c.Comision
             ORDER BY venta DESC LIMIT 15`),

        // ── Ventas por forma de pago / terminal ──
        run(`SELECT t.Terminal AS terminal, COALESCE(SUM(v.Venta),0) AS venta
             FROM tblVentasTerminales v
             JOIN tblTerminales t ON v.IdTerminal = t.IdTerminal
             WHERE v.IdSucursal = ${branchId} AND v.Mes = ${mes} AND v.Anio = ${year}
             GROUP BY t.IdTerminal, t.Terminal
             ORDER BY venta DESC LIMIT 10`),

        // ── Ventas por turno (usando canales) ──
        run(`SELECT t.Turno AS turno, COALESCE(SUM(v.Venta),0) AS venta
             FROM tblVentasCanalesVenta v
             JOIN tblTurnos t ON v.IdTurno = t.IdTurno
             WHERE v.IdSucursal = ${branchId} AND v.Mes = ${mes} AND v.Anio = ${year}
             GROUP BY t.IdTurno, t.Turno
             ORDER BY venta DESC LIMIT 8`),

        // ── Nómina ──
        run(`SELECT COALESCE(SUM(Pago),0) AS total, COUNT(DISTINCT IdUsuario) AS empleados
             FROM tblNomina
             WHERE IdSucursal = ${branchId} AND Mes = ${mes} AND Anio = ${year} LIMIT 1`),

        // ── Gastos totales ──
        run(`SELECT COALESCE(SUM(Total),0) AS total
             FROM tblGastos
             WHERE IdSucursal = ${branchId} AND Mes = ${mes} AND Anio = ${year} AND Status = 0 LIMIT 1`),

        // ── Compras ──
        run(`SELECT COALESCE(SUM(Total),0) AS total
             FROM tblCompras
             WHERE IdSucursal = ${branchId} AND MONTH(FechaCompra) = ${mes} AND YEAR(FechaCompra) = ${year} AND Status = 0 LIMIT 1`),

        // ── Top gastos por concepto ──
        run(`SELECT ConceptoGasto AS concepto, COALESCE(SUM(Total),0) AS total
             FROM tblGastos
             WHERE IdSucursal = ${branchId} AND Mes = ${mes} AND Anio = ${year} AND Status = 0
             GROUP BY ConceptoGasto ORDER BY total DESC LIMIT 8`),

        // ── Top proveedores ──
        run(`SELECT p.Proveedor AS proveedor, COALESCE(SUM(c.Total),0) AS total
             FROM tblCompras c JOIN tblProveedores p ON c.IdProveedor = p.IdProveedor
             WHERE c.IdSucursal = ${branchId} AND MONTH(c.FechaCompra) = ${mes} AND YEAR(c.FechaCompra) = ${year} AND c.Status = 0
             GROUP BY p.IdProveedor, p.Proveedor ORDER BY total DESC LIMIT 6`),

        // ── Empleados activos en nómina ──
        run(`SELECT COUNT(DISTINCT IdUsuario) AS activos FROM tblNomina
             WHERE IdSucursal = ${branchId} AND Mes = ${mes} AND Anio = ${year} LIMIT 1`),

        // ── Objetivo de ventas ──
        run(`SELECT COALESCE(ObjetivoVentas,0) AS objetivo
             FROM tblSucursalesCostos
             WHERE IdSucursal = ${branchId} AND Mes = ${mes} AND Anio = ${year} LIMIT 1`),

        // ── Mes anterior: canales ──
        run(`SELECT COALESCE(SUM(Venta),0) AS total
             FROM tblVentasCanalesVenta
             WHERE IdSucursal = ${branchId}
               AND Mes = ${mes === 1 ? 12 : mes - 1}
               AND Anio = ${mes === 1 ? year - 1 : year} LIMIT 1`),

        // ── Mes anterior: terminales ──
        run(`SELECT COALESCE(SUM(Venta),0) AS total
             FROM tblVentasTerminales
             WHERE IdSucursal = ${branchId}
               AND Mes = ${mes === 1 ? 12 : mes - 1}
               AND Anio = ${mes === 1 ? year - 1 : year} LIMIT 1`),
    ]);

    // Total ventas = canales + terminales (fuentes distintas de captura)
    const totalCanales    = (canalesRows as any[]).reduce((s, r) => s + Number(r.venta || 0), 0);
    const totalTerminales = (terminalesRows as any[]).reduce((s, r) => s + Number(r.venta || 0), 0);
    // Usa el mayor de los dos (el negocio puede capturar en una tabla o la otra)
    const totalVentas = Math.max(totalCanales, totalTerminales);

    const totalNomina  = Number(nominaRows[0]?.total  ?? 0);
    const totalGastos  = Number(gastosRows[0]?.total  ?? 0);
    const totalCompras = Number(comprasRows[0]?.total ?? 0);
    const objetivo     = Number(objetivoRows[0]?.objetivo ?? 0);
    const empleados    = Number(empleadosRows[0]?.activos ?? 0);

    const prevCanales    = Number(mesAnteriorCanalesRows[0]?.total ?? 0);
    const prevTerminales = Number(mesAnteriorTerminalesRows[0]?.total ?? 0);
    const totalPrevVentas = Math.max(prevCanales, prevTerminales);

    return {
        totalVentas,
        totalCanales,
        totalTerminales,
        totalNomina,
        totalGastos,
        totalCompras,
        objetivo,
        empleados,
        ventasPrevMes: totalPrevVentas,
        canales:    canalesRows,
        terminales: terminalesRows,
        turnos:     turnosCanalesRows,
        topGastos:  topGastosRows,
        topProveedores: topProvRows,
    };
}

export async function POST(req: Request) {
    let connection: any = null;
    try {
        const body: SummaryRequest = await req.json();
        const { projectId, branchId, month, year, branchName = 'Sucursal' } = body;

        if (!projectId || !branchId) {
            return NextResponse.json({ error: 'projectId y branchId requeridos' }, { status: 400 });
        }

        connection = await getProjectConnection(projectId);
        const m = await fetchMetrics(connection, branchId, month, year);

        const mes    = month + 1;
        const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const mesNombre = months[month] ?? `Mes ${mes}`;

        const fmt = (n: number) => new Intl.NumberFormat('es-MX', {
            style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
        }).format(n);
        const pctOf = (a: number, b: number) => b > 0 ? `${((a / b) * 100).toFixed(1)}%` : 'N/A';

        const foodCostPct  = m.totalVentas > 0 ? (m.totalCompras / m.totalVentas) * 100 : 0;
        const laborCostPct = m.totalVentas > 0 ? (m.totalNomina  / m.totalVentas) * 100 : 0;
        const opExpPct     = m.totalVentas > 0 ? (m.totalGastos  / m.totalVentas) * 100 : 0;
        const primeCost    = foodCostPct + laborCostPct;
        const utilidad     = m.totalVentas - m.totalNomina - m.totalGastos - m.totalCompras;
        const utilidadPct  = m.totalVentas > 0 ? (utilidad / m.totalVentas) * 100 : 0;
        const cumpObj      = m.objetivo > 0 ? (m.totalVentas / m.objetivo) * 100 : 0;
        const varVsMes     = m.ventasPrevMes > 0
            ? `${((m.totalVentas - m.ventasPrevMes) / m.ventasPrevMes * 100).toFixed(1)}%`
            : 'sin dato';

        const canalesStr    = m.canales.length > 0
            ? m.canales.map((c: any) => `  - ${c.canal}: ${fmt(c.venta)} (comisión ${c.comision}%)`).join('\n')
            : '  - Sin capturas de canales de venta';
        const terminalesStr = m.terminales.length > 0
            ? m.terminales.map((t: any) => `  - ${t.terminal}: ${fmt(t.venta)}`).join('\n')
            : '  - Sin capturas de formas de pago';
        const turnosStr     = m.turnos.length > 0
            ? m.turnos.map((t: any) => `  - ${t.turno}: ${fmt(t.venta)}`).join('\n')
            : '  - Sin datos de turnos';
        const gastosStr     = m.topGastos.length > 0
            ? m.topGastos.map((g: any) => `  - ${g.concepto}: ${fmt(g.total)}`).join('\n')
            : '  - Sin gastos registrados';
        const provsStr      = m.topProveedores.length > 0
            ? m.topProveedores.map((p: any) => `  - ${p.proveedor}: ${fmt(p.total)}`).join('\n')
            : '  - Sin compras registradas';

        const prompt = `Eres el Agente Foodie Guru, consultor senior en rentabilidad restaurantera con 20 años de experiencia. Analiza los KPIs del período ${mesNombre} ${year} de la sucursal "${branchName}" y genera un resumen ejecutivo completo para el dueño del negocio.

NOTA IMPORTANTE DE FUENTES DE DATOS:
- Las ventas provienen de DOS tablas: tblVentasCanalesVenta (canales de entrega) y tblVentasTerminales (formas de pago)
- Se usa el mayor de los dos totales como referencia de ventas (${m.totalCanales >= m.totalTerminales ? 'canales' : 'terminales'} = ${fmt(m.totalVentas)})
- tblVentas NO se usa (tabla legacy ignorada)

══════════════════════
DATOS ${mesNombre.toUpperCase()} ${year} — ${branchName.toUpperCase()}
══════════════════════

VENTAS TOTALES:
  Por canales de venta:  ${fmt(m.totalCanales)}
  Por formas de pago:    ${fmt(m.totalTerminales)}
  Referencia usada:      ${fmt(m.totalVentas)}
  Objetivo del mes:      ${fmt(m.objetivo)}  →  Cumplimiento: ${cumpObj.toFixed(1)}%
  Variación vs mes ant.: ${varVsMes}  (mes ant. = ${fmt(m.ventasPrevMes)})

VENTAS POR CANAL DE VENTA (apps delivery / canales):
${canalesStr}

VENTAS POR FORMA DE PAGO:
${terminalesStr}

VENTAS POR TURNO:
${turnosStr}

COSTOS Y MÁRGENES:
  Compras / Food Cost:   ${fmt(m.totalCompras)} = ${pctOf(m.totalCompras, m.totalVentas)}  [Benchmark ideal: 28-35%, alerta >38%]
  Nómina / Labor Cost:   ${fmt(m.totalNomina)}  = ${pctOf(m.totalNomina,  m.totalVentas)}  [Benchmark ideal: 25-32%, alerta >35%]
  Gastos operativos:     ${fmt(m.totalGastos)}  = ${pctOf(m.totalGastos,  m.totalVentas)}  [Benchmark ideal: 10-15%]
  Prime Cost (F+L):      ${primeCost.toFixed(1)}%                                           [Benchmark ideal: <60%, riesgo >65%]
  Utilidad estimada:     ${fmt(utilidad)} = ${utilidadPct.toFixed(1)}%                     [Benchmark saludable: 15-25%]

NÓMINA:
  Total pagado:          ${fmt(m.totalNomina)}
  Empleados en nómina:   ${m.empleados}
  Costo prom/empleado:   ${fmt(m.empleados > 0 ? m.totalNomina / m.empleados : 0)}

TOP GASTOS POR CONCEPTO:
${gastosStr}

TOP PROVEEDORES (por volumen de compra):
${provsStr}

══════════════════════
BENCHMARKS DE LA INDUSTRIA
══════════════════════
- Food cost ideal: 28-35%. >38% = alerta roja.
- Labor cost ideal: 25-32%. >35% = alerta.
- Prime cost ideal: <60%. >65% = zona de pérdida.
- Gastos operativos: 10-15%.
- Utilidad operativa sana: 15-25%.
- Comisiones delivery (Rappi/Uber/DiDi): 25-30% — impacto crítico en rentabilidad.
- Merma aceptable: <3% del costo de inventario.

══════════════════════
INSTRUCCIONES
══════════════════════
Genera un análisis ejecutivo en Markdown rico y útil. Incluye:

1. **Resumen Ejecutivo** — 3-4 oraciones. Estado general del negocio este mes. Menciona la cifra de ventas, utilidad y un hallazgo clave.

2. **KPIs Clave** — Tabla Markdown con: Métrica | Valor | % Ventas | Benchmark | Semáforo (🟢 bien / 🟡 atención / 🔴 alerta).

3. **💡 Hallazgos Importantes** — 4-6 puntos con datos concretos. Compara contra benchmark. Menciona canales de mayor riesgo (comisiones delivery), turnos más rentables, proveedores clave, etc.

4. **⚠️ Alertas Prioritarias** — Solo si algún KPI está fuera de benchmark. Sé específico (ej. "Tu food cost del 42% está 7 puntos sobre el benchmark de 35%").

5. **✅ Recomendaciones Accionables** — 4-6 acciones concretas y específicas que el dueño puede implementar esta semana. No generalidades.

6. **📊 Análisis de Canales de Venta** — Evalúa el mix de canales. ¿Qué % representa el delivery? ¿Las comisiones son sostenibles? ¿Conviene potenciar algún canal?

7. **❓ Preguntas para Profundizar** — 3 preguntas que el dueño debería hacerle al Agente Foodie Guru para entender mejor su negocio.

Responde en español. Sé directo y útil. Usa emojis de semáforo para señalizar estado. Menciona cifras específicas, nunca generalidades.`;

        const response = await anthropic.messages.create({
            model: 'claude-opus-4-8',
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        });

        const summary = response.content[0].type === 'text' ? response.content[0].text : '';

        return NextResponse.json({ summary, model: 'claude-opus-4-8' });

    } catch (error: any) {
        console.error('Dashboard Summary Error:', error);
        return NextResponse.json({ error: 'Error generando resumen', details: error.message }, { status: 500 });
    } finally {
        if (connection) {
            try { await connection.end(); } catch { }
        }
    }
}
