/**
 * Fuente de verdad del menú para PERMISOS de usuario.
 * Las llaves (`key`) coinciden con las del Sidebar (`src/components/dashboard/Sidebar.tsx`).
 * Es un módulo de DATOS puro (sin React/mysql) para poder usarlo tanto en el cliente
 * (UI de permisos) como en el servidor (validación). Si agregas un menú al Sidebar,
 * agrégalo aquí con la misma `key` y aparecerá automáticamente en los permisos.
 */

export interface MenuPermItem { key: string; label: string; href: string }
export interface MenuPermSection { key: string; label: string; items: MenuPermItem[] }

export const PERMISSION_MENU: MenuPermSection[] = [
    {
        key: 'general', label: 'General', items: [
            { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
            { key: 'agente', label: 'Agente Foodie Gurú', href: '/dashboard/agente' },
        ],
    },
    {
        key: 'reportsAI', label: 'Reportes IA', items: [
            { key: 'advancedAgent', label: 'Agente Avanzado', href: '/dashboard/reportes/nuevo' },
            { key: 'myReports', label: 'Mis Reportes', href: '/dashboard/reportes' },
        ],
    },
    {
        key: 'configuration', label: 'Configuración', items: [
            { key: 'project', label: 'Proyecto', href: '/dashboard/config/project' },
            { key: 'initialLoad', label: 'Carga Inicial', href: '/dashboard/config/initial-load' },
            { key: 'branches', label: 'Sucursales', href: '/dashboard/settings/branches' },
            { key: 'employees', label: 'Empleados', href: '/dashboard/payroll/employees' },
            { key: 'taxes', label: 'Impuestos', href: '/dashboard/config/taxes' },
            { key: 'breakEvenAnalysis', label: 'Análisis de Punto de Equilibrio', href: '/dashboard/config/break-even' },
        ],
    },
    {
        key: 'sales', label: 'Ventas', items: [
            { key: 'salesChannelsCapture', label: 'Captura de Canales de Venta', href: '/dashboard/sales/channels-capture' },
            { key: 'appPriceCalculator', label: 'Calculadora de Precios App', href: '/dashboard/sales/app-price-calculator' },
            // Oculto temporalmente del menú/permisos (la página sigue en /dashboard/wansoft):
            // { key: 'wansoftSales', label: 'Ventas por Sucursal (Wansoft)', href: '/dashboard/wansoft' },
        ],
    },
    {
        key: 'inventories', label: 'Inventarios', items: [
            { key: 'products', label: 'Productos', href: '/dashboard/inventories/products' },
            { key: 'inventoryCapture', label: 'Captura de Inventario', href: '/dashboard/inventories/capture' },
            { key: 'minMax', label: 'Mínimos y Máximos', href: '/dashboard/inventories/min-max' },
            { key: 'wasteCapture', label: 'Captura de Mermas', href: '/dashboard/inventories/waste-capture' },
        ],
    },
    {
        key: 'purchases', label: 'Compras', items: [
            { key: 'suppliers', label: 'Proveedores', href: '/dashboard/purchases/suppliers' },
            { key: 'purchaseOrders', label: 'Órdenes de Compra', href: '/dashboard/purchases/purchase-orders' },
            { key: 'purchasesCapture', label: 'Captura de Compras', href: '/dashboard/purchases/capture' },
        ],
    },
    {
        key: 'expenses', label: 'Gastos', items: [
            { key: 'expenseConcepts', label: 'Conceptos de Gasto', href: '/dashboard/expenses/concepts' },
            { key: 'expensesCapture', label: 'Captura de Gastos', href: '/dashboard/expenses/capture' },
        ],
    },
    {
        key: 'payroll', label: 'Nómina', items: [
            { key: 'schedules', label: 'Horarios', href: '/dashboard/payroll/schedules' },
            { key: 'payrollCapture', label: 'Captura de Nómina', href: '/dashboard/payroll/capture' },
        ],
    },
    {
        key: 'production', label: 'Producción', items: [
            { key: 'subRecipes', label: 'Sub-recetas', href: '/dashboard/production/sub-recipes' },
            { key: 'dishes', label: 'Platillos', href: '/dashboard/production/dishes' },
            { key: 'productionCapture', label: 'Captura de Producción', href: '/dashboard/production/capture' },
            { key: 'materialExplosion', label: 'Explosión de Materiales', href: '/dashboard/production/material-explosion' },
        ],
    },
];

// Todas las llaves de menú válidas (para validar permisos en el servidor).
export const ALL_MENU_KEYS: string[] = PERMISSION_MENU.flatMap(s => s.items.map(i => i.key));
