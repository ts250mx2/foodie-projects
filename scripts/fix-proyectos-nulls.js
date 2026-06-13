/**
 * scripts/fix-proyectos-nulls.js
 *
 * Script de migración ONE-SHOT para homologar tblProyectos en BDFoodieProjects.
 * Corrige los proyectos que quedaron sin BaseDatos, Servidor, UsarioBD, PasswdBD o UUID.
 *
 * Uso: node scripts/fix-proyectos-nulls.js [--dry-run]
 *   --dry-run  Muestra qué cambiaría sin aplicar nada.
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
const crypto = require('crypto');

const DRY_RUN = process.argv.includes('--dry-run');

// Convención: nombre del proyecto → nombre de BD (igual que db-init.ts)
function toDbName(proyecto) {
    const sanitized = String(proyecto || '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '');
    return `FG_${sanitized}`;
}

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || '74.208.192.90',
        user: process.env.DB_USER || 'kyk',
        password: process.env.DB_PASSWORD || 'merkurio',
        database: process.env.DB_NAME || 'BDFoodieProjects',
        port: Number(process.env.DB_PORT) || 3306,
    });

    console.log('Conectado a BDFoodieProjects.\n');

    // 1. Obtener todos los proyectos activos con algún campo de conexión NULL
    const [projects] = await conn.query(`
        SELECT IdProyecto, Proyecto, BaseDatos, Servidor, UsarioBD, PasswdBD, UUID, Status
        FROM tblProyectos
        WHERE Status <> 2
        ORDER BY IdProyecto
    `);

    console.log(`Total de proyectos activos: ${projects.length}\n`);

    const toFix = projects.filter(p =>
        !p.BaseDatos || !p.Servidor || !p.UsarioBD || !p.PasswdBD
    );

    if (toFix.length === 0) {
        console.log('✅ Todos los proyectos ya tienen sus campos de conexión completos. Nada que hacer.');
        await conn.end();
        return;
    }

    // Proyectos que solo les falta UUID (no son críticos, pero los uniformamos)
    const missingUuid = projects.filter(p =>
        !p.UUID && p.BaseDatos && p.Servidor && p.UsarioBD && p.PasswdBD
    );

    console.log('='.repeat(60));
    console.log(`Proyectos con campos de conexión incompletos: ${toFix.length}`);
    console.log('='.repeat(60));

    const servidor = process.env.DB_HOST || '74.208.192.90';
    const usuarioBD = process.env.DB_USER || 'kyk';
    const passwdBD = process.env.DB_PASSWORD || 'merkurio';

    for (const p of toFix) {
        const baseDatos = p.BaseDatos || toDbName(p.Proyecto);
        const uuid = p.UUID || crypto.randomUUID();

        console.log(`\nProyecto #${p.IdProyecto}: "${p.Proyecto}"`);
        console.log(`  BaseDatos : ${p.BaseDatos || '⚠️ NULL'} → ${baseDatos}`);
        console.log(`  Servidor  : ${p.Servidor || '⚠️ NULL'} → ${servidor}`);
        console.log(`  UsarioBD  : ${p.UsarioBD || '⚠️ NULL'} → ${usuarioBD}`);
        console.log(`  PasswdBD  : ${p.PasswdBD || '⚠️ NULL'} → [configurado]`);
        console.log(`  UUID      : ${p.UUID || '⚠️ NULL'} → ${uuid}`);

        if (!DRY_RUN) {
            await conn.query(`
                UPDATE tblProyectos SET
                    BaseDatos = COALESCE(BaseDatos, ?),
                    Servidor  = COALESCE(Servidor,  ?),
                    UsarioBD  = COALESCE(UsarioBD,  ?),
                    PasswdBD  = COALESCE(PasswdBD,  ?),
                    UUID      = COALESCE(UUID,       ?),
                    FechaAct  = NOW()
                WHERE IdProyecto = ?
            `, [baseDatos, servidor, usuarioBD, passwdBD, uuid, p.IdProyecto]);
            console.log(`  ✅ Actualizado.`);
        } else {
            console.log(`  🔍 [DRY-RUN] No se aplicó ningún cambio.`);
        }
    }

    // Asignar UUID a los que solo les faltaba ese campo
    if (missingUuid.length > 0) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Proyectos con UUID faltante (conexión OK): ${missingUuid.length}`);
        console.log('='.repeat(60));
        for (const p of missingUuid) {
            const uuid = crypto.randomUUID();
            console.log(`\nProyecto #${p.IdProyecto}: "${p.Proyecto}" → UUID: ${uuid}`);
            if (!DRY_RUN) {
                await conn.query(
                    `UPDATE tblProyectos SET UUID = ?, FechaAct = NOW() WHERE IdProyecto = ?`,
                    [uuid, p.IdProyecto]
                );
                console.log(`  ✅ UUID asignado.`);
            } else {
                console.log(`  🔍 [DRY-RUN] No se aplicó ningún cambio.`);
            }
        }
    }

    // 2. Resumen final
    const [after] = await conn.query(`
        SELECT IdProyecto, Proyecto, BaseDatos, Servidor, UsarioBD, PasswdBD, UUID, Status
        FROM tblProyectos
        WHERE Status <> 2
        ORDER BY IdProyecto
    `);

    const stillBroken = after.filter(p => !p.BaseDatos || !p.Servidor || !p.UsarioBD || !p.PasswdBD);

    console.log(`\n${'='.repeat(60)}`);
    if (DRY_RUN) {
        console.log('🔍 Modo DRY-RUN — sin cambios reales. Ejecuta sin --dry-run para aplicar.');
    } else if (stillBroken.length === 0) {
        console.log('✅ Migración completada. Todos los proyectos ahora tienen campos de conexión completos.');
    } else {
        console.log(`⚠️  Aún quedan ${stillBroken.length} proyectos incompletos (posiblemente sin nombre de proyecto):`);
        stillBroken.forEach(p => console.log(`   #${p.IdProyecto}: "${p.Proyecto}"`));
    }
    console.log('='.repeat(60));

    await conn.end();
}

main().catch(err => {
    console.error('❌ Error en migración:', err.message);
    process.exit(1);
});
