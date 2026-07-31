import type { Connection } from 'mysql2/promise';

/**
 * Banderas de módulos opcionales del proyecto (columnas en BDFoodieProjects.tblProyectos).
 * Controlan qué submenús y pestañas aparecen en la app:
 *  - RecetarioEnabled: pestaña "Costeo" en platillos/sub-recetas + submenú Explosión de Materiales.
 *  - PurchaseOrdersEnabled: submenús Órdenes de Compra, Órdenes de Salida y Almacén.
 *  - POSConnectionEnabled: submenú Conexión a Punto de Venta.
 *  - QuotesEnabled: submenús Cotizaciones y Calendario de Eventos.
 *  - MinMaxEnabled: submenú Mínimos y Máximos.
 *  - SchedulesEnabled: submenú Horarios.
 * Todas arrancan habilitadas (1) para no cambiar el comportamiento de proyectos existentes.
 */
export const MODULE_FLAG_COLUMNS = [
    'RecetarioEnabled',
    'PurchaseOrdersEnabled',
    'POSConnectionEnabled',
    'QuotesEnabled',
    'MinMaxEnabled',
    'SchedulesEnabled',
] as const;

export type ModuleFlagColumn = typeof MODULE_FLAG_COLUMNS[number];

/** Forma en que viajan las banderas al cliente (camelCase). */
export interface ProjectModuleFlags {
    recetarioEnabled: number;
    purchaseOrdersEnabled: number;
    posConnectionEnabled: number;
    quotesEnabled: number;
    minMaxEnabled: number;
    schedulesEnabled: number;
}

/**
 * Crea las columnas de banderas si aún no existen. Idempotente: se puede llamar en
 * cada request. Se usa SHOW COLUMNS + ALTER porque `ADD COLUMN IF NOT EXISTS` no
 * existe en MySQL 8 (solo en MariaDB).
 */
export async function ensureModuleFlagColumns(connection: Connection): Promise<void> {
    try {
        const [cols]: any = await connection.query('SHOW COLUMNS FROM tblProyectos');
        const existing = new Set((cols as any[]).map((c) => c.Field));
        for (const column of MODULE_FLAG_COLUMNS) {
            if (!existing.has(column)) {
                await connection.query(
                    `ALTER TABLE tblProyectos ADD COLUMN \`${column}\` TINYINT NOT NULL DEFAULT 1`
                );
            }
        }
    } catch (e) {
        console.error('Error ensuring project module flag columns:', e);
    }
}

/** Normaliza un valor de la BD a 0/1; ausente o NULL cuenta como habilitado. */
export const toFlag = (value: unknown): number => (value === 0 || value === '0' ? 0 : 1);

/** Extrae las tres banderas de un renglón de tblProyectos. */
export function readModuleFlags(row: Record<string, unknown>): ProjectModuleFlags {
    return {
        recetarioEnabled: toFlag(row.RecetarioEnabled),
        purchaseOrdersEnabled: toFlag(row.PurchaseOrdersEnabled),
        posConnectionEnabled: toFlag(row.POSConnectionEnabled),
        quotesEnabled: toFlag(row.QuotesEnabled),
        minMaxEnabled: toFlag(row.MinMaxEnabled),
        schedulesEnabled: toFlag(row.SchedulesEnabled),
    };
}

type FlagName = keyof ProjectModuleFlags | 'appPriceCalculatorEnabled';

/**
 * Submenú (key del menú) → bandera que lo controla. Lo usa el Sidebar para
 * ocultar los módulos apagados; los menús que no aparecen aquí siempre se muestran.
 */
export const MENU_KEY_TO_FLAG: Record<string, FlagName> = {
    appPriceCalculator: 'appPriceCalculatorEnabled',
    purchaseOrders: 'purchaseOrdersEnabled',
    outboundOrders: 'purchaseOrdersEnabled',
    warehouse: 'purchaseOrdersEnabled',
    posConnection: 'posConnectionEnabled',
    quotes: 'quotesEnabled',
    eventsCalendar: 'quotesEnabled',
    minMax: 'minMaxEnabled',
    schedules: 'schedulesEnabled',
};

/**
 * Sección completa del menú (title) → bandera que la controla. Al apagar el
 * Recetario desaparece TODO el menú de Producción (sub-recetas, platillos,
 * captura y explosión de materiales), no solo la explosión.
 */
export const MENU_SECTION_TO_FLAG: Record<string, FlagName> = {
    production: 'recetarioEnabled',
};
