/**
 * Helpers de servidor para permisos de menú por empleado (tabla tblEmpleadosPermisos
 * en la BD de cada proyecto). Reciben una conexión ya abierta (el caller la cierra).
 */
import type { Connection } from 'mysql2/promise';
import { ALL_MENU_KEYS } from '@/lib/menu';

const VALID_KEYS = new Set(ALL_MENU_KEYS);

/** Devuelve el mapa { menuKey: boolean } de permisos de un empleado. */
export async function getPermissions(connection: Connection, employeeId: number): Promise<Record<string, boolean>> {
    const map: Record<string, boolean> = {};
    try {
        const [rows] = await connection.query<any[]>(
            'SELECT MenuKey, Permitido FROM tblEmpleadosPermisos WHERE IdEmpleado = ?',
            [employeeId]
        );
        for (const r of rows) map[r.MenuKey] = Number(r.Permitido) === 1;
    } catch { /* tabla aún no creada en esa BD: regresa vacío */ }
    return map;
}

/**
 * Guarda (upsert) los permisos de un empleado. `permissions` es { menuKey: boolean }.
 * Solo persiste llaves válidas (las del menú). Si es null/undefined no hace nada.
 */
export async function savePermissions(
    connection: Connection, employeeId: number, permissions?: Record<string, unknown> | null
): Promise<void> {
    if (!permissions || typeof permissions !== 'object') return;
    const entries = Object.entries(permissions).filter(([k]) => VALID_KEYS.has(k));
    if (entries.length === 0) return;
    const values = entries.map(([key, val]) => [employeeId, key, val ? 1 : 0]);
    await connection.query(
        `INSERT INTO tblEmpleadosPermisos (IdEmpleado, MenuKey, Permitido, FechaAct)
         VALUES ${values.map(() => '(?, ?, ?, NOW())').join(', ')}
         ON DUPLICATE KEY UPDATE Permitido = VALUES(Permitido), FechaAct = NOW()`,
        values.flat()
    );
}
