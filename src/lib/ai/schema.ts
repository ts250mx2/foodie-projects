/**
 * Esquema ENRIQUECIDO de la base de datos de un proyecto Foodie Guru.
 *
 * IMPORTANTE — ARQUITECTURA MULTI-TENANT:
 * Cada proyecto (restaurante) tiene su PROPIA base de datos con esta MISMA
 * estructura, pero con datos y catálogos distintos. Por eso este archivo
 * describe solo la ESTRUCTURA (igual para todos). Los VALORES reales de cada
 * proyecto (sucursales, canales, terminales, turnos, convención de mes, etc.)
 * se inyectan en tiempo de ejecución desde `buildProjectCatalog()` (catalog.ts),
 * que consulta la BD del proyecto logueado.
 *
 * Verificado por introspección directa contra BDs de producción (2026-06).
 */

export const DATABASE_SCHEMA = `
ESQUEMA DE DATOS (estructura común a todos los proyectos)
═══════════════════════════════════════════════════════════

⚠️ CONVENCIÓN DE MES — LEE EL BLOQUE "CATÁLOGO DEL PROYECTO" MÁS ABAJO.
Distintas tablas guardan el mes con distinta convención y además VARÍA entre
proyectos. NUNCA asumas 1-12 de forma global. Usa SIEMPRE el offset por tabla
indicado en "CONVENCIÓN DE MES (detectada en vivo)" del catálogo del proyecto.
Como referencia general (verificada, pero el catálogo manda):
  • tblVentasCanalesVenta, tblVentasTerminales → Mes 0-11 (Enero=0 … Diciembre=11)
  • tblGastos, tblInventarios, tblSucursalesCostos → Mes 1-12 (Enero=1)
  • tblNomina → INCONSISTENTE entre proyectos (puede ser 0-11 o 1-12) → usa el catálogo
  • tblCompras NO tiene columna Mes; filtra por FechaCompra con MONTH()/YEAR() (1-12 natural)

REGLA DE STATUS (en casi todas las tablas):
  • Status = 0 → activo / vigente
  • Status = 2 → anulado / eliminado / inactivo
  Filtra registros válidos con "Status <> 2" (o "Status = 0"). En compras/gastos
  esto evita contar cancelados.

───────────────────────────────────────────────────────────
VENTAS  (⚠️ Mes 0-11 en estas dos tablas — ver catálogo)
───────────────────────────────────────────────────────────
La venta NO se guarda en una sola tabla. Hay dos registros paralelos del MISMO
ingreso, capturados por dimensiones distintas:

• Ventas por CANAL DE VENTA (comedor, para llevar, domicilio, Uber, Rappi, DiDi…)
    tblVentasCanalesVenta v JOIN tblCanalesVenta c ON v.IdCanalVenta = c.IdCanalVenta
    v: Dia, Mes(0-11), Anio, IdTurno, IdCanalVenta, Venta, IdSucursal
    c: IdCanalVenta, CanalVenta, Comision(% sobre la venta), Orden, Status, IdSucursal

• Ventas por FORMA DE PAGO / TERMINAL (efectivo, tarjeta, transferencia…)
    tblVentasTerminales v JOIN tblTerminales t ON v.IdTerminal = t.IdTerminal
    v: Dia, Mes(0-11), Anio, IdTurno, IdTerminal, Venta, IdSucursal
    t: IdTerminal, Terminal, Comision(%), Status, IdSucursal

• TOTAL de ventas de un período:
    El negocio captura en canales, en terminales, o en ambos. Para el total NO
    sumes las dos tablas (duplicarías). Calcula el total de cada una por separado
    y usa el MAYOR de los dos (representa el ingreso real registrado).

• tblVentas → ❌ IGNORAR. Tabla legacy. NUNCA la uses para reportar ventas.
• tblVentasDia (IdSucursal, Dia, Mes, Anio, Ventas) → rollup diario, normalmente
  poco poblado; prefiere canales/terminales salvo que se pida explícitamente.
• tblPlataformas suele estar VACÍA en estos proyectos; el delivery (Uber/Rappi/DiDi)
  vive como CanalVenta, no como Plataforma.

Comisión de un canal/terminal = SUM(Venta) * (Comision/100). Las comisiones de
delivery (Uber/Rappi/DiDi) suelen ser 30-35% → impacto crítico en margen.

───────────────────────────────────────────────────────────
GASTOS  (Mes 1-12)
───────────────────────────────────────────────────────────
tblGastos: IdGasto, IdProveedor, FechaGasto, Dia, Mes(1-12), Anio, IdConceptoGasto,
           Total, IdSucursal, IdCanalPago, ConceptoGasto, Status, NumeroFactura
  • IdProveedor = -2 → gasto de comisión/impuesto generado por un canal de venta
  • IdProveedor = -1 → sin proveedor
tblConceptosGastos: IdConceptoGasto, ConceptoGasto, Status, ReferenciaObligatoria, IdCanalPago
tblDetalleGastos:   IdDetalleGasto, IdGasto, Concepto, Cantidad, Costo, Status
  → desglose línea por línea de un gasto.

───────────────────────────────────────────────────────────
COMPRAS (insumos / materia prima)  — filtra por FechaCompra (1-12 natural)
───────────────────────────────────────────────────────────
tblCompras: IdCompra, ConceptoCompra, FechaCompra(datetime), IdProveedor, NumeroFactura,
            Status, Subtotal, Iva, Total, IdCanalPago, Referencia, PagarA, IdSucursal
  • Filtra período con MONTH(FechaCompra)=mm AND YEAR(FechaCompra)=aaaa
  • Excluye canceladas con Status <> 2
tblDetalleCompras: IdDetalleCompra, IdCompra, IdProducto, Producto, Cantidad, Costo,
                   Iva, Total, Codigo, Status
tblProveedores: IdProveedor, Proveedor, RFC, Status, EsProveedorGasto
  • EsProveedorGasto = 1 → proveedor de gasto operativo (no insumo)
  • EsProveedorGasto = 0 → proveedor de insumos/materia prima

───────────────────────────────────────────────────────────
INVENTARIO Y MERMA  (Mes 1-12)
───────────────────────────────────────────────────────────
tblInventarios: IdProducto, Dia, Mes(1-12), Anio, FechaInventario, Cantidad, Precio,
                Consumo, IdSucursal
  • Valor de inventario = SUM(Cantidad * COALESCE(v.CostoInventario, Precio)) uniendo
    a vlProductos v ON v.IdProducto = tblInventarios.IdProducto
  • Para "último inventario" toma la fecha más reciente (Anio,Mes,Dia) con valor > 0.
tblMermas: IdProducto, Dia, Mes(1-12), Anio, Cantidad, Precio, IdSucursal
  • Valor de merma = SUM(Cantidad * Precio). Suele estar vacía.
tblSucursalesMaximosMinimos: IdProducto, IdSucursal, Minimo, Maximo
  • "productos por debajo del mínimo" = inventario actual del producto < Minimo.

───────────────────────────────────────────────────────────
NÓMINA Y PROPINAS  (⚠️ tblNomina: convención de mes según catálogo)
───────────────────────────────────────────────────────────
tblNomina: Dia, Mes(VER CATÁLOGO), Anio, IdUsuario(=IdEmpleado), Pago, IdSucursal
  • Costo de nómina del período = SUM(Pago).
  • Une a empleados con tblEmpleados ON IdEmpleado = tblNomina.IdUsuario.
tblPropinasEmpleados: IdEmpleado, IdSucursal, IdTurno, Dia, Mes, Anio, IdPerfilPropina,
                      Venta, Porcentaje, Monto, MontoPropina
tblPerfilesPropinas: IdPerfilPropina, PerfilPropina, EsActivo, Status

───────────────────────────────────────────────────────────
EMPLEADOS, PUESTOS, TURNOS, SUCURSALES
───────────────────────────────────────────────────────────
tblEmpleados:  IdEmpleado, Empleado, IdPuesto, IdSucursal, Status(0=activo), Sueldo
tblPuestos:    IdPuesto, Puesto, Status, TienePropina
tblTurnos:     IdTurno, Turno, HoraInicio, HoraFin, Status, IdSucursal
tblSucursales: IdSucursal, Sucursal, Status, IdEmpleadoGerente, TipoNomina, DiaInicio
tblSucursalesCostos: IdSucursal, Mes(1-12), Anio, ObjetivoVentas, CostoMateriaPrima,
                     CostoNomina, GastoOperativo
  • Objetivos/metas del mes por sucursal (meta de ventas, costos objetivo).
tblSucursalesEmpleados: IdSucursal, IdEmpleado (relación N:N)

───────────────────────────────────────────────────────────
PRODUCTOS, RECETAS, PRODUCCIÓN, MENÚ
───────────────────────────────────────────────────────────
vlProductos (VISTA — usa SIEMPRE esta, no tblProductos):
  IdProducto, Producto, Codigo, Precio, IVA, Status, IdCategoria, Categoria,
  Costo, CostoInventario, ConversionSimple, Rendimiento, IdTipoProducto,
  UnidadMedidaCompra, UnidadMedidaInventario, UnidadMedidaRecetario
vlPlatillos (VISTA de ingeniería de menú / costeo de platillos):
  IdProducto, Producto, Precio, IVA, SeccionMenu, IdSeccionMenu,
  PorcentajeCostoIdeal, Costo, PorcentajeCosto, AlertaCosto
  • PorcentajeCosto = costo real del platillo como % del precio.
  • AlertaCosto = 1 → el platillo excede su costo ideal (margen en riesgo).
tblProductosKits: IdProductoPadre, IdProductoHijo, Cantidad → recetas / sub-recetas.
tblProduccion: IdProduccion, FechaProduccion(datetime), IdProducto, Cantidad, Precio,
               IdSucursal, Exploto → producción de platillos/lotes. Filtra por
               MONTH(FechaProduccion)/YEAR(FechaProduccion).
tblCategorias: IdCategoria, Categoria, Status, EsRecetario
tblSeccionesMenu: IdSeccionMenu, SeccionMenu, Status

───────────────────────────────────────────────────────────
JOINS CLAVE
───────────────────────────────────────────────────────────
tblVentasCanalesVenta.IdCanalVenta → tblCanalesVenta.IdCanalVenta  (CanalVenta, Comision)
tblVentasTerminales.IdTerminal     → tblTerminales.IdTerminal      (Terminal, Comision)
tblVentas*.IdTurno                 → tblTurnos.IdTurno              (Turno)
tblGastos.IdConceptoGasto          → tblConceptosGastos.IdConceptoGasto
tblGastos.IdProveedor / tblCompras.IdProveedor → tblProveedores.IdProveedor
tblNomina.IdUsuario                = tblEmpleados.IdEmpleado
tblEmpleados.IdPuesto              → tblPuestos.IdPuesto
tblInventarios.IdProducto          → vlProductos.IdProducto
Casi todas las tablas operativas tienen IdSucursal → tblSucursales.IdSucursal
`.trim();
