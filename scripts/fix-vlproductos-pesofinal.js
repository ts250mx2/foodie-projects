/**
 * scripts/fix-vlproductos-pesofinal.js
 *
 * Corrige el costo cero en vlProductos.
 *
 * Causa: en la rama de insumos (IdTipoProducto = 0) la vista multiplica por
 * `A`.`PesoFinal` SIN la guardia CASE que sí tienen CantidadCompra y
 * ConversionSimple. Si PesoFinal es NULL, `precio * NULL = NULL` y el costo
 * llega como NULL a la app, que lo pinta como $0.000. Lo mismo pasa con
 * `G`.`PesoFinal` (el del ingrediente) dentro del SUM de subrecetas: esos
 * renglones aportan cero al costo del padre sin avisar.
 *
 * El parche agrega la guardia en las tres multiplicaciones y, de paso, cierra
 * la fuga gemela de `G`.`ConversionSimple` en CostoInventario, cuyo CASE solo
 * cubría `= 0` y le faltaba el `IS NULL`.
 *
 * SOLO toca la definición de la vista. Con --normalize-data además pone
 * PesoFinal/ConversionSimple = 1 donde son NULL (opcional: una vez parcheada
 * la vista, NULL y 1 dan el mismo costo; sirve para que el modal de costeo no
 * muestre el campo vacío y no truene su validación "Peso Final mayor a 0").
 *
 * Uso: node scripts/fix-vlproductos-pesofinal.js [--dry-run] [--normalize-data]
 *   --dry-run          Muestra qué cambiaría sin aplicar nada.
 *   --normalize-data   Además, PesoFinal/ConversionSimple NULL -> 1.
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
const NORMALIZE_DATA = process.argv.includes('--normalize-data');

const TEMPLATE_DB = process.env.TEMPLATE_DB || 'FG_Frijoles';
const CENTRAL_DB = process.env.DB_NAME || 'BDFoodieProjects';

const GUARD_A = '(case when ((`A`.`PesoFinal` = 0) or (`A`.`PesoFinal` is null)) then 1 else `A`.`PesoFinal` end)';
const GUARD_G = '(case when ((`G`.`PesoFinal` = 0) or (`G`.`PesoFinal` is null)) then 1 else `G`.`PesoFinal` end)';

/**
 * Reemplazos dirigidos sobre el cuerpo de la vista. Cada uno declara cuántas
 * ocurrencias espera: si el conteo no cuadra la vista cambió y abortamos en
 * lugar de escribir una definición a medias.
 */
const EDITS = [
    {
        name: 'Costo (insumos): guardia en A.PesoFinal',
        from: '* `A`.`PesoFinal`) else sum(',
        to: '* ' + GUARD_A + ') else sum(',
        expect: 1,
    },
    {
        name: 'Costo + CostoInventario (subrecetas): guardia en G.PesoFinal',
        from: '* `G`.`PesoFinal`))',
        to: '* ' + GUARD_G + '))',
        expect: 2,
    },
    {
        name: 'CostoInventario: falta IS NULL en G.ConversionSimple',
        from: '(case when (`G`.`ConversionSimple` = 0) then 1 else `G`.`ConversionSimple` end)',
        to: '(case when ((`G`.`ConversionSimple` = 0) or (`G`.`ConversionSimple` is null)) then 1 else `G`.`ConversionSimple` end)',
        expect: 1,
    },
];

function patchViewBody(body) {
    let out = body;
    for (const edit of EDITS) {
        const found = out.split(edit.from).length - 1;
        if (found !== edit.expect) {
            throw new Error(
                `parche "${edit.name}": esperaba ${edit.expect} ocurrencia(s), encontré ${found}`
            );
        }
        out = out.split(edit.from).join(edit.to);
    }
    return out;
}

function isAlreadyPatched(body) {
    return !body.includes('* `A`.`PesoFinal`) else sum(');
}

async function getViewBody(conn) {
    const [rows] = await conn.query('SHOW CREATE VIEW `vlProductos`');
    return rows[0]['Create View'].replace(/^.*?\sAS\s+/is, '');
}

async function countNullCost(conn) {
    const [rows] = await conn.query('SELECT COUNT(*) AS n FROM vlProductos WHERE Costo IS NULL');
    return rows[0].n;
}

async function listTargets(central) {
    const [rows] = await central.query(
        'SELECT IdProyecto, Proyecto, BaseDatos, Servidor, ' +
        'COALESCE(UsuarioBD, UsarioBD) AS Usuario, COALESCE(PasswordBD, PasswdBD) AS Passwd ' +
        'FROM tblProyectos WHERE BaseDatos IS NOT NULL ORDER BY IdProyecto'
    );

    const targets = [];
    const seen = new Set();
    // La plantilla va primero: es la fuente del db-sync hacia proyectos nuevos.
    targets.push({
        Proyecto: 'PLANTILLA',
        BaseDatos: TEMPLATE_DB,
        Servidor: process.env.DB_HOST || '74.208.192.90',
        Usuario: process.env.DB_USER,
        Passwd: process.env.DB_PASSWORD,
    });
    seen.add(TEMPLATE_DB);

    for (const row of rows) {
        if (seen.has(row.BaseDatos)) continue;
        seen.add(row.BaseDatos);
        targets.push(row);
    }
    return targets;
}

async function processTarget(target, templatePatchedBody) {
    const result = { db: target.BaseDatos, proyecto: target.Proyecto };
    let conn;
    try {
        conn = await mysql.createConnection({
            host: target.Servidor,
            user: target.Usuario || process.env.DB_USER,
            password: target.Passwd || process.env.DB_PASSWORD,
            database: target.BaseDatos,
            port: parseInt(process.env.DB_PORT || '3306', 10),
            connectTimeout: 15000,
        });

        let patched;
        try {
            const body = await getViewBody(conn);
            if (isAlreadyPatched(body)) {
                result.estado = 'ya parchada';
                result.costoNullAntes = await countNullCost(conn);
                return result;
            }
            result.costoNullAntes = await countNullCost(conn);
            patched = patchViewBody(body);
        } catch (e) {
            // La vista no existe en esta BD (proyecto nuevo sin sincronizar):
            // se crea con la definición ya corregida de la plantilla.
            if (!/doesn't exist|Unknown table/i.test(e.message)) throw e;
            result.estado = DRY_RUN ? 'se crearía (no existe)' : 'creada (no existía)';
            patched = templatePatchedBody;
        }

        if (DRY_RUN) {
            result.estado = result.estado || 'se parcharía';
            return result;
        }

        await conn.query('CREATE OR REPLACE VIEW `vlProductos` AS ' + patched);
        result.costoNullDespues = await countNullCost(conn);
        result.estado = result.estado || 'parchada';

        if (NORMALIZE_DATA) {
            const [pf] = await conn.query('UPDATE tblProductos SET PesoFinal = 1 WHERE PesoFinal IS NULL');
            const [cs] = await conn.query('UPDATE tblProductos SET ConversionSimple = 1 WHERE ConversionSimple IS NULL');
            result.datosNormalizados = `${pf.affectedRows} PesoFinal, ${cs.affectedRows} ConversionSimple`;
        }
        return result;
    } catch (e) {
        result.estado = 'ERROR: ' + e.message.slice(0, 70);
        return result;
    } finally {
        if (conn) await conn.end();
    }
}

async function main() {
    console.log(`vlProductos: guardia de PesoFinal${DRY_RUN ? '  [DRY RUN]' : ''}`);
    console.log(`plantilla: ${TEMPLATE_DB}   normalizar datos: ${NORMALIZE_DATA ? 'sí' : 'no'}\n`);

    const central = await mysql.createConnection({
        host: process.env.DB_HOST || '74.208.192.90',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: CENTRAL_DB,
        port: parseInt(process.env.DB_PORT || '3306', 10),
    });

    let targets;
    let templatePatchedBody;
    try {
        targets = await listTargets(central);

        // La definición corregida de la plantilla sirve de molde para las BD
        // que todavía no tienen la vista.
        const tplConn = await mysql.createConnection({
            host: process.env.DB_HOST || '74.208.192.90',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: TEMPLATE_DB,
            port: parseInt(process.env.DB_PORT || '3306', 10),
        });
        try {
            const body = await getViewBody(tplConn);
            templatePatchedBody = isAlreadyPatched(body) ? body : patchViewBody(body);
        } finally {
            await tplConn.end();
        }
    } finally {
        await central.end();
    }

    const results = [];
    for (const target of targets) {
        results.push(await processTarget(target, templatePatchedBody));
    }

    console.table(results);

    const errores = results.filter(r => r.estado.startsWith('ERROR'));
    if (errores.length > 0) {
        console.log(`\n${errores.length} BD con error (revisa host/credenciales en tblProyectos).`);
        process.exitCode = 1;
    }
}

main().catch(e => {
    console.error('FALLO:', e.message);
    process.exit(1);
});
