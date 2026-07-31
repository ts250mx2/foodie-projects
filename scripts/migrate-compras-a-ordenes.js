/**
 * scripts/migrate-compras-a-ordenes.js
 *
 * Convierte las COMPRAS CAPTURADAS (tblCompras + tblDetalleCompras) de un proyecto
 * en ÓRDENES DE COMPRA en estado FANTASMA (Status 4), listas para "Aplicar" al
 * inventario de almacén desde la pantalla de Órdenes de Compra.
 *
 * Idempotente: cada orden creada lleva en Notas el marcador "[Compra #N]"; las
 * compras que ya tienen orden generada se omiten en ejecuciones posteriores.
 *
 * Uso:
 *   node scripts/migrate-compras-a-ordenes.js [--dry-run] [--project <nombre>]
 *     --dry-run           Muestra qué se crearía sin escribir nada.
 *     --project <nombre>  Filtro del nombre del proyecto (default: "frijol").
 */

// Carga .env.local manualmente (no requiere el paquete dotenv)
const fs = require('fs');
const path = require('path');
try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length > 0) process.env[key.trim()] = rest.join('=').trim();
    }
} catch { /* .env.local no existe, se usan los defaults */ }

const mysql = require('mysql2/promise');

const DRY_RUN = process.argv.includes('--dry-run');
const projectArgIdx = process.argv.indexOf('--project');
const PROJECT_FILTER = projectArgIdx !== -1 ? process.argv[projectArgIdx + 1] : 'frijol';

/** Estado "Fantasma": pendiente de aplicar al inventario o descartar. */
const STATUS_PHANTOM = 4;

async function main() {
    const master = await mysql.createConnection({
        host: process.env.DB_HOST || '74.208.192.90',
        user: process.env.DB_USER || 'kyk',
        password: process.env.DB_PASSWORD || 'merkurio',
        database: process.env.DB_NAME || 'BDFoodieProjects',
        port: Number(process.env.DB_PORT) || 3306,
    });

    // 1. Localizar el proyecto (SELECT * porque el nombre de las columnas de
    //    credenciales varía entre instalaciones: UsuarioBD/UsarioBD, PasswordBD/PasswdBD)
    const [projects] = await master.query(
        `SELECT * FROM tblProyectos
         WHERE Status <> 2 AND Proyecto LIKE ?
         ORDER BY IdProyecto`,
        [`%${PROJECT_FILTER}%`]
    );
    await master.end();

    if (projects.length === 0) {
        console.error(`❌ No se encontró ningún proyecto activo cuyo nombre contenga "${PROJECT_FILTER}".`);
        process.exit(1);
    }
    if (projects.length > 1) {
        console.error(`❌ Hay ${projects.length} proyectos que coinciden con "${PROJECT_FILTER}". Usa --project con un nombre más específico:`);
        projects.forEach(p => console.error(`   #${p.IdProyecto}: "${p.Proyecto}" (${p.BaseDatos})`));
        process.exit(1);
    }

    const project = projects[0];
    const dbUser = project.UsuarioBD || project.UsarioBD;
    const dbPass = project.PasswordBD || project.PasswdBD;
    if (!project.BaseDatos || !project.Servidor || !dbUser || !dbPass) {
        console.error(`❌ El proyecto #${project.IdProyecto} no tiene configuración de BD completa en tblProyectos.`);
        process.exit(1);
    }
    console.log(`Proyecto: #${project.IdProyecto} "${project.Proyecto}" → BD ${project.BaseDatos} @ ${project.Servidor}`);
    if (DRY_RUN) console.log('🔍 Modo DRY-RUN: no se escribirá nada.\n');

    const db = await mysql.createConnection({
        host: project.Servidor,
        user: dbUser,
        password: dbPass,
        database: project.BaseDatos,
        timezone: '-06:00',
    });
    await db.query("SET time_zone = '-06:00'");

    // 2. Compras ya migradas (marcador [Compra #N] en Notas de la orden)
    const [migratedRows] = await db.query(
        `SELECT Notas FROM tblOrdenesCompra WHERE Notas LIKE '[Compra #%'`
    );
    const migrated = new Set();
    for (const row of migratedRows) {
        const match = /^\[Compra #(\d+)\]/.exec(row.Notas || '');
        if (match) migrated.add(Number(match[1]));
    }
    if (migrated.size > 0) {
        console.log(`Compras ya migradas anteriormente: ${migrated.size} (se omiten).`);
    }

    // 3. Compras activas y TODOS sus renglones válidos (una sola consulta cada uno,
    //    agrupando en memoria: 1152 compras × 1 SELECT por compra sería lentísimo).
    const [compras] = await db.query(`
        SELECT c.IdCompra, c.ConceptoCompra, c.FechaCompra, c.IdProveedor, c.NumeroFactura,
               c.Total, c.IdSucursal, p.Proveedor
        FROM tblCompras c
        LEFT JOIN tblProveedores p ON p.IdProveedor = c.IdProveedor
        WHERE (c.Status IS NULL OR c.Status <> 2)
        ORDER BY c.FechaCompra, c.IdCompra
    `);

    const [allItems] = await db.query(`
        SELECT IdCompra, IdProducto, Cantidad, Costo
        FROM tblDetalleCompras
        WHERE (Status IS NULL OR Status <> 2)
          AND IdProducto IS NOT NULL AND Cantidad > 0
    `);
    const itemsByCompra = new Map();
    for (const item of allItems) {
        if (!itemsByCompra.has(item.IdCompra)) itemsByCompra.set(item.IdCompra, []);
        itemsByCompra.get(item.IdCompra).push(item);
    }

    console.log(`Compras capturadas activas: ${compras.length}\n`);

    let created = 0;
    let skippedMigrated = 0;
    let skippedNoItems = 0;

    for (const compra of compras) {
        if (migrated.has(compra.IdCompra)) {
            skippedMigrated++;
            continue;
        }

        const items = itemsByCompra.get(compra.IdCompra) || [];

        if (items.length === 0) {
            console.log(`⏭️  Compra #${compra.IdCompra} (${compra.Proveedor || 'sin proveedor'}) sin renglones válidos — omitida.`);
            skippedNoItems++;
            continue;
        }

        const fecha = compra.FechaCompra ? new Date(compra.FechaCompra) : null;
        const fechaLabel = fecha ? fecha.toISOString().split('T')[0] : 's/f';
        const notasParts = [`[Compra #${compra.IdCompra}]`];
        if (compra.NumeroFactura) notasParts.push(`Factura ${compra.NumeroFactura}`);
        if (compra.ConceptoCompra) notasParts.push(String(compra.ConceptoCompra).slice(0, 150));
        const notas = notasParts.join(' — ');

        console.log(`📦 Compra #${compra.IdCompra} · ${fechaLabel} · ${compra.Proveedor || 'sin proveedor'} · ${items.length} renglones · $${Number(compra.Total || 0).toFixed(2)}`);

        if (DRY_RUN) {
            created++;
            continue;
        }

        await db.beginTransaction();
        try {
            const [result] = await db.query(
                `INSERT INTO tblOrdenesCompra
                    (IdProveedor, IdSucursal, EsInterna, FechaOrden, FechaEntrega, FechaProgramadaEntrega, Status, Notas, FechaAct)
                 VALUES (?, ?, 0, ?, NULL, NULL, ?, ?, Now())`,
                [compra.IdProveedor || 0, compra.IdSucursal, compra.FechaCompra || new Date(), STATUS_PHANTOM, notas]
            );
            const idOrden = result.insertId;

            // Renglones en un solo INSERT multi-fila (rendimiento sobre conexión remota).
            const detailRows = items.map(item => {
                const cantidad = Number(item.Cantidad) || 0;
                const costo = Number(item.Costo) || 0;
                return [idOrden, item.IdProducto, cantidad, costo, cantidad * costo];
            });
            await db.query(
                `INSERT INTO tblOrdenesCompraDetalle
                    (IdOrdenCompra, IdProducto, Cantidad, PrecioUnitario, Total, FechaAct)
                 VALUES ${detailRows.map(() => '(?, ?, ?, ?, ?, Now())').join(', ')}`,
                detailRows.flat()
            );

            await db.commit();
            console.log(`   ✅ Orden OC-${idOrden} creada en estado Fantasma.`);
            created++;
        } catch (err) {
            await db.rollback();
            console.error(`   ❌ Error creando la orden de la compra #${compra.IdCompra}: ${err.message}`);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(DRY_RUN ? '🔍 DRY-RUN terminado (sin cambios reales):' : '✅ Migración terminada:');
    console.log(`   Órdenes ${DRY_RUN ? 'que se crearían' : 'creadas'}: ${created}`);
    console.log(`   Omitidas (ya migradas): ${skippedMigrated}`);
    console.log(`   Omitidas (sin renglones válidos): ${skippedNoItems}`);
    console.log('='.repeat(60));

    await db.end();
}

main().catch(err => {
    console.error('❌ Error en migración:', err.message);
    process.exit(1);
});
