// Registro declarativo de TODOS los reportes de Wansoft (Reportes → Ingresos).
// Es la fuente única de verdad: de aquí salen tanto el parseo del HTML como el
// esquema de cada tabla destino. Para agregar/ajustar un reporte basta con
// editar este archivo.
//
// Estructura de cada reporte:
//   key       Identificador interno (también nombre del contenedor/div en Wansoft).
//   endpoint  Ruta AJAX (POST) bajo WANSOFT_URL que devuelve el fragmento.
//   title     Nombre legible (español).
//   table     Tabla MySQL destino.
//   kind      'rowReport' (lista en .rowReport) | 'twoCard' (2 tarjetas con
//             sección) | 'chart' (datos embebidos en Highcharts).
//   columns   Columnas de datos en el ORDEN en que aparecen en cada fila.
//             type: 'str' | 'money' | 'int' | 'num'.
//
// Las columnas comunes (Fecha, IdSucursal, Sucursal, CapturadoEn) las agrega la
// capa de BD; aquí sólo van las columnas propias del reporte.

const STD = (extra) => extra; // helper de legibilidad

export const REPORTS = [
  {
    key: 'SalesByPaymentType',
    endpoint: 'Reports/SalesByPaymentType',
    title: 'Ventas por forma de pago',
    table: 'tblWansoftSalesByPaymentType',
    kind: 'rowReport',
    columns: STD([
      { col: 'Tipo', type: 'str' },
      { col: 'Total', type: 'money' },
      { col: 'Porcentaje', type: 'num' },
    ]),
  },
  {
    key: 'SalesByGroup',
    endpoint: 'Reports/SalesByGroup',
    title: 'Ventas por grupo',
    table: 'tblWansoftSalesByGroup',
    kind: 'rowReport',
    columns: [
      { col: 'Grupo', type: 'str' },
      { col: 'Subtotal', type: 'money' },
      { col: 'Iva', type: 'money' },
      { col: 'Total', type: 'money' },
      { col: 'Porcentaje', type: 'num' },
    ],
  },
  {
    key: 'SalesByGroupType',
    endpoint: 'Reports/SalesByGroupType',
    title: 'Ventas por tipo de grupo',
    table: 'tblWansoftSalesByGroupType',
    kind: 'rowReport',
    columns: [
      { col: 'Tipo', type: 'str' },
      { col: 'Subtotal', type: 'money' },
      { col: 'Iva', type: 'money' },
      { col: 'Total', type: 'money' },
      { col: 'Porcentaje', type: 'num' },
    ],
  },
  {
    key: 'SalesByArea',
    endpoint: 'Reports/SalesByArea',
    title: 'Ventas por zona',
    table: 'tblWansoftSalesByArea',
    kind: 'rowReport',
    columns: [
      { col: 'Zona', type: 'str' },
      { col: 'Clientes', type: 'int' },
      { col: 'Ventas', type: 'int' },
      { col: 'Subtotal', type: 'money' },
      { col: 'Total', type: 'money' },
    ],
  },
  {
    key: 'SalesByOrder',
    endpoint: 'Reports/SalesByTypeOfOrder',
    title: 'Ventas por tipo de orden',
    table: 'tblWansoftSalesByOrder',
    kind: 'rowReport',
    columns: [
      { col: 'Tipo', type: 'str' },
      { col: 'PorPersona', type: 'money' },
      { col: 'Personas', type: 'int' },
      { col: 'Cuentas', type: 'int' },
      { col: 'Subtotal', type: 'money' },
      { col: 'Total', type: 'money' },
    ],
  },
  {
    key: 'SalesByHour',
    endpoint: 'Reports/SalesByHours',
    title: 'Ventas por hora',
    table: 'tblWansoftSalesByHour',
    kind: 'chart',
    // El reporte se dibuja como gráfica; los datos van en el series de Highcharts.
    chart: { x: 'Hora', xType: 'str', y: 'Ventas', yType: 'money' },
    columns: [
      { col: 'Hora', type: 'str' },
      { col: 'Ventas', type: 'money' },
    ],
  },
  {
    key: 'SalesByUser',
    endpoint: 'Reports/SalesByUser',
    title: 'Ventas por usuario',
    table: 'tblWansoftSalesByUser',
    kind: 'rowReport',
    columns: [
      { col: 'Usuario', type: 'str' },
      { col: 'Subtotal', type: 'money' },
      { col: 'Iva', type: 'money' },
      { col: 'Total', type: 'money' },
      { col: 'Porcentaje', type: 'num' },
    ],
  },
  {
    key: 'SalesByTerminal',
    endpoint: 'Reports/SalesByTerminal',
    title: 'Ventas por terminal',
    table: 'tblWansoftSalesByTerminal',
    kind: 'rowReport',
    columns: [
      { col: 'Terminal', type: 'str' },
      { col: 'Subtotal', type: 'money' },
      { col: 'Iva', type: 'money' },
      { col: 'Total', type: 'money' },
      { col: 'Porcentaje', type: 'num' },
    ],
  },
  {
    key: 'SalesByComplementary',
    endpoint: 'Reports/SalesByModifiers',
    title: 'Ventas por modificador',
    table: 'tblWansoftSalesByModifier',
    kind: 'rowReport',
    columns: [
      { col: 'Grupo', type: 'str' },
      { col: 'Modificador', type: 'str' },
      { col: 'Cantidad', type: 'int' },
      { col: 'Subtotal', type: 'money' },
      { col: 'Total', type: 'money' },
    ],
  },
  {
    key: 'SalesBySaucer',
    endpoint: 'Reports/SalesBySaucer',
    title: 'Ventas por platillo / artículo',
    table: 'tblWansoftSalesBySaucer',
    kind: 'rowReport',
    columns: [
      { col: 'Platillo', type: 'str' },
      { col: 'Cantidad', type: 'int' },
      { col: 'Subtotal', type: 'money' },
      { col: 'Total', type: 'money' },
      { col: 'Porcentaje', type: 'num' },
    ],
  },
  {
    key: 'TipsByUser',
    endpoint: 'Reports/TipByUser',
    title: 'Propinas por mesero',
    table: 'tblWansoftTipsByUser',
    kind: 'rowReport',
    columns: [
      { col: 'Mesero', type: 'str' },
      { col: 'Monto', type: 'money' },
      { col: 'Porcentaje', type: 'num' },
    ],
  },
  {
    key: 'Promotions',
    endpoint: 'Reports/Promotions',
    title: 'Promociones aplicadas',
    table: 'tblWansoftPromotions',
    kind: 'rowReport',
    columns: [
      { col: 'Promocion', type: 'str' },
      { col: 'Tipo', type: 'str' },
      { col: 'Aplicadas', type: 'int' },
      { col: 'TotalDescontado', type: 'money' },
    ],
  },
  {
    key: 'PersonsByHour',
    endpoint: 'Reports/PersonsByHour',
    title: 'Personas por hora',
    table: 'tblWansoftPersonsByHour',
    kind: 'rowReport',
    columns: [
      { col: 'Hora', type: 'str' },
      { col: 'Personas', type: 'int' },
    ],
  },
  {
    key: 'PersonsByDay',
    endpoint: 'Reports/PersonsByDay',
    title: 'Personas por fecha',
    table: 'tblWansoftPersonsByDay',
    kind: 'rowReport',
    columns: [
      { col: 'Dia', type: 'str' },
      { col: 'Personas', type: 'int' },
    ],
  },
  {
    key: 'PersonsByDayName',
    endpoint: 'Reports/PersonsByDayName',
    title: 'Personas por día de la semana',
    table: 'tblWansoftPersonsByDayName',
    kind: 'rowReport',
    columns: [
      { col: 'Dia', type: 'str' },
      { col: 'Personas', type: 'int' },
    ],
  },
  {
    key: 'ChargePaymentMethod',
    endpoint: 'Reports/ChargePaymentMethod',
    title: 'Cobros por forma de pago',
    table: 'tblWansoftChargePaymentMethod',
    kind: 'rowReport',
    columns: [
      { col: 'FormaPago', type: 'str' },
      { col: 'Total', type: 'money' },
    ],
  },
  {
    key: 'CancelSalesDetail',
    endpoint: 'Reports/CancelSalesDetail',
    title: 'Detalle de cancelaciones',
    table: 'tblWansoftCancelSales',
    kind: 'twoCard',
    columns: [
      { col: 'Seccion', type: 'str' },
      { col: 'Autorizador', type: 'str' },
      { col: 'Subtotal', type: 'money' },
      { col: 'Total', type: 'money' },
    ],
  },
  {
    key: 'CourtesiesDetail',
    endpoint: 'Reports/CourtesiesDetail',
    title: 'Detalle de cortesías',
    table: 'tblWansoftCourtesies',
    kind: 'twoCard',
    columns: [
      { col: 'Seccion', type: 'str' },
      { col: 'Autorizador', type: 'str' },
      { col: 'Subtotal', type: 'money' },
      { col: 'Total', type: 'money' },
    ],
  },
  {
    key: 'DiscountsDetail',
    endpoint: 'Reports/DiscountsDetail',
    title: 'Detalle de descuentos',
    table: 'tblWansoftDiscounts',
    kind: 'twoCard',
    columns: [
      { col: 'Seccion', type: 'str' },
      { col: 'Autorizador', type: 'str' },
      { col: 'Subtotal', type: 'money' },
      { col: 'Total', type: 'money' },
    ],
  },
  {
    key: 'SaleNullificationDetail',
    endpoint: 'Reports/SaleNullificationDetail',
    title: 'Detalle de anulaciones',
    table: 'tblWansoftNullifications',
    kind: 'twoCard',
    columns: [
      { col: 'Seccion', type: 'str' },
      { col: 'Autorizador', type: 'str' },
      { col: 'Subtotal', type: 'money' },
      { col: 'Total', type: 'money' },
    ],
  },
  {
    key: 'MegaPointsReport',
    endpoint: 'Reports/MegaPointsReport',
    title: 'Megapuntos',
    table: 'tblWansoftMegaPoints',
    kind: 'rowReport',
    optional: true, // sólo existe si la cuenta tiene servicio de Megapuntos
    columns: [
      { col: 'Concepto', type: 'str' },
      { col: 'Cantidad', type: 'int' },
      { col: 'Monto', type: 'money' },
    ],
  },
];

export const REPORTS_BY_KEY = Object.fromEntries(REPORTS.map((r) => [r.key, r]));
