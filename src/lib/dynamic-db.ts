import mysql, { Connection } from 'mysql2/promise';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { TEMPLATE_DB, syncDatabaseWithTemplate } from '@/lib/db-template';

interface ProjectConfig extends RowDataPacket {
    BaseDatos: string;
    Servidor: string;
    UsarioBD: string;
    PasswdBD: string;
}

const verifiedProjects = new Set<number>();

async function ensureDocumentTablesAndColumns(connection: Connection) {
    try {
        // 1. Ensure tblTiposDocumentos exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblTiposDocumentos\` (
              \`IdTipoDocumento\` int NOT NULL AUTO_INCREMENT,
              \`TipoDocumento\` varchar(45) DEFAULT NULL,
              \`Status\` int DEFAULT '0',
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdTipoDocumento\`)
            ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
        `);

        // 2. Ensure tblEmpleadosDocumentos exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblEmpleadosDocumentos\` (
              \`IdEmpleadoDocumento\` int NOT NULL AUTO_INCREMENT,
              \`IdEmpleado\` int NOT NULL,
              \`Documento\` varchar(255) DEFAULT NULL,
              \`Comentarios\` text DEFAULT NULL,
              \`RutaArchivo\` varchar(500) DEFAULT NULL,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdEmpleadoDocumento\`)
            ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
        `);

        // Check columns for tblEmpleadosDocumentos
        const [empColumns]: any = await connection.query('SHOW COLUMNS FROM tblEmpleadosDocumentos');
        const empColNames = empColumns.map((c: any) => c.Field);
        
        if (!empColNames.includes('IdTipoDocumento')) {
            await connection.query('ALTER TABLE tblEmpleadosDocumentos ADD COLUMN IdTipoDocumento INT NULL');
        }
        if (!empColNames.includes('ArchivoDocumento')) {
            await connection.query('ALTER TABLE tblEmpleadosDocumentos ADD COLUMN ArchivoDocumento LONGTEXT NULL');
        }
        if (!empColNames.includes('NombreArchivo')) {
            await connection.query('ALTER TABLE tblEmpleadosDocumentos ADD COLUMN NombreArchivo VARCHAR(245) NULL');
        }

        // 3. Ensure tblSucursalesDocumentos exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblSucursalesDocumentos\` (
              \`IdSucursalDocumento\` int NOT NULL AUTO_INCREMENT,
              \`IdSucursal\` int NOT NULL,
              \`Documento\` varchar(255) DEFAULT NULL,
              \`Comentarios\` text DEFAULT NULL,
              \`RutaArchivo\` varchar(500) DEFAULT NULL,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdSucursalDocumento\`)
            ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
        `);

        // Check columns for tblSucursalesDocumentos
        const [sucColumns]: any = await connection.query('SHOW COLUMNS FROM tblSucursalesDocumentos');
        const sucColNames = sucColumns.map((c: any) => c.Field);

        if (!sucColNames.includes('ArchivoDocumento')) {
            await connection.query('ALTER TABLE tblSucursalesDocumentos ADD COLUMN ArchivoDocumento LONGTEXT NULL');
        }
        if (!sucColNames.includes('NombreArchivo')) {
            await connection.query('ALTER TABLE tblSucursalesDocumentos ADD COLUMN NombreArchivo VARCHAR(245) NULL');
        }
    } catch (e) {
        console.error('Error ensuring document schemas:', e);
    }
}

/**
 * Asegura el esquema de accesos y permisos por empleado en la BD del proyecto:
 *  - columnas Login / Passwd / EsAdministrador en tblEmpleados (acceso del empleado);
 *  - tabla tblEmpleadosPermisos (permisos de menú por empleado).
 * Idempotente: se aplica en CADA BD de proyecto la primera vez que se conecta.
 */
export async function ensureAccessAndPermissions(connection: Connection) {
    try {
        const [empCols]: any = await connection.query('SHOW COLUMNS FROM tblEmpleados');
        const empNames = empCols.map((c: any) => c.Field);
        if (!empNames.includes('Login')) {
            await connection.query('ALTER TABLE tblEmpleados ADD COLUMN Login VARCHAR(150) NULL');
        }
        if (!empNames.includes('Passwd')) {
            await connection.query('ALTER TABLE tblEmpleados ADD COLUMN Passwd VARCHAR(255) NULL');
        }
        if (!empNames.includes('EsAdministrador')) {
            await connection.query('ALTER TABLE tblEmpleados ADD COLUMN EsAdministrador TINYINT NOT NULL DEFAULT 0');
        }

        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblEmpleadosPermisos\` (
              \`IdPermiso\` int NOT NULL AUTO_INCREMENT,
              \`IdEmpleado\` int NOT NULL,
              \`MenuKey\` varchar(80) NOT NULL,
              \`Permitido\` tinyint NOT NULL DEFAULT 0,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdPermiso\`),
              UNIQUE KEY \`uq_empleado_menu\` (\`IdEmpleado\`, \`MenuKey\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Migración: "Sucursales" (branches) e "Impuestos" (taxes) se fusionaron
        // dentro de "Configuración General" (project) — sucursales como pestañas e
        // impuestos como botón. Quien tuviera acceso a esos menús debe conservar
        // acceso al menú fusionado. Idempotente: tras correr una vez no quedan filas
        // 'branches'/'taxes', así que las siguientes ejecuciones no hacen nada.
        await connection.query(`
            INSERT INTO tblEmpleadosPermisos (IdEmpleado, MenuKey, Permitido, FechaAct)
            SELECT DISTINCT IdEmpleado, 'project', 1, NOW()
            FROM tblEmpleadosPermisos
            WHERE MenuKey IN ('branches', 'taxes') AND Permitido = 1
            ON DUPLICATE KEY UPDATE Permitido = 1, FechaAct = NOW()
        `);
        await connection.query(`DELETE FROM tblEmpleadosPermisos WHERE MenuKey IN ('branches', 'taxes')`);
    } catch (e) {
        console.error('Error ensuring access/permissions schema:', e);
    }
}

/**
 * Asegura el esquema del módulo de Cotizaciones de eventos (por proyecto):
 *  - tblCotizaciones: cabecera de la cotización del evento (con totales calculados);
 *  - tblCotizacionesGastos: desglose de gastos operativos por cotización.
 * Idempotente.
 */
async function ensureQuotesTables(connection: Connection) {
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblCotizaciones\` (
              \`IdCotizacion\` int NOT NULL AUTO_INCREMENT,
              \`NombreEvento\` varchar(255) NOT NULL,
              \`FechaEvento\` date DEFAULT NULL,
              \`IdPlatillo\` int DEFAULT NULL,
              \`Platillo\` varchar(255) DEFAULT NULL,
              \`CantidadPlatillos\` int NOT NULL DEFAULT 0,
              \`CostoPorPlatillo\` decimal(14,2) NOT NULL DEFAULT 0,
              \`PrecioPorPlatillo\` decimal(14,2) NOT NULL DEFAULT 0,
              \`GastosOperativos\` decimal(14,2) NOT NULL DEFAULT 0,
              \`Recaudacion\` decimal(14,2) NOT NULL DEFAULT 0,
              \`CostoPlatillos\` decimal(14,2) NOT NULL DEFAULT 0,
              \`IngresoEstimado\` decimal(14,2) NOT NULL DEFAULT 0,
              \`CostoTotal\` decimal(14,2) NOT NULL DEFAULT 0,
              \`UtilidadEstimada\` decimal(14,2) NOT NULL DEFAULT 0,
              \`UtilidadReal\` decimal(14,2) NOT NULL DEFAULT 0,
              \`Notas\` text,
              \`Status\` int NOT NULL DEFAULT 0,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdCotizacion\`),
              KEY \`idx_status_fecha\` (\`Status\`, \`FechaEvento\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Columnas agregadas después de la creación inicial (tablas ya existentes).
        const [cotCols]: any = await connection.query('SHOW COLUMNS FROM tblCotizaciones');
        const cotNames = cotCols.map((c: any) => c.Field);
        if (!cotNames.includes('IdPlatillo')) {
            await connection.query('ALTER TABLE tblCotizaciones ADD COLUMN IdPlatillo int DEFAULT NULL AFTER FechaEvento');
        }
        if (!cotNames.includes('Platillo')) {
            await connection.query('ALTER TABLE tblCotizaciones ADD COLUMN Platillo varchar(255) DEFAULT NULL AFTER IdPlatillo');
        }
        // Hora del evento (formato HH:MM) y estatus del evento (pendiente | confirmada).
        if (!cotNames.includes('HoraEvento')) {
            await connection.query("ALTER TABLE tblCotizaciones ADD COLUMN HoraEvento varchar(5) DEFAULT NULL AFTER FechaEvento");
        }
        if (!cotNames.includes('EstatusEvento')) {
            await connection.query("ALTER TABLE tblCotizaciones ADD COLUMN EstatusEvento varchar(20) NOT NULL DEFAULT 'pendiente'");
        }

        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblCotizacionesGastos\` (
              \`IdCotizacionGasto\` int NOT NULL AUTO_INCREMENT,
              \`IdCotizacion\` int NOT NULL,
              \`Concepto\` varchar(255) NOT NULL,
              \`Monto\` decimal(14,2) NOT NULL DEFAULT 0,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdCotizacionGasto\`),
              KEY \`idx_cotizacion\` (\`IdCotizacion\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Líneas de platillo de cada cotización (una cotización tiene varios platillos).
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblCotizacionesPlatillos\` (
              \`IdCotizacionPlatillo\` int NOT NULL AUTO_INCREMENT,
              \`IdCotizacion\` int NOT NULL,
              \`IdPlatillo\` int DEFAULT NULL,
              \`Platillo\` varchar(255) DEFAULT NULL,
              \`Tipo\` int DEFAULT NULL,
              \`Cantidad\` int NOT NULL DEFAULT 0,
              \`CostoUnitario\` decimal(14,2) NOT NULL DEFAULT 0,
              \`PrecioUnitario\` decimal(14,2) NOT NULL DEFAULT 0,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdCotizacionPlatillo\`),
              KEY \`idx_cotizacion\` (\`IdCotizacion\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        // Plantillas de cotización: conceptos + gastos guardados como JSON para
        // reutilizarlos en futuras cotizaciones.
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblCotizacionesPlantillas\` (
              \`IdPlantilla\` int NOT NULL AUTO_INCREMENT,
              \`Nombre\` varchar(255) NOT NULL,
              \`Datos\` longtext,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdPlantilla\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Tipo de producto de la línea (0=insumo, 1=platillo, 2=sub-receta, null=manual).
        const [platCols]: any = await connection.query('SHOW COLUMNS FROM tblCotizacionesPlatillos');
        const platNames = platCols.map((c: any) => c.Field);
        if (!platNames.includes('Tipo')) {
            await connection.query('ALTER TABLE tblCotizacionesPlatillos ADD COLUMN Tipo int DEFAULT NULL AFTER Platillo');
        }
        // Unidad de medida de la línea (default: UnidadMedidaInventario del producto; editable).
        if (!platNames.includes('Unidad')) {
            await connection.query('ALTER TABLE tblCotizacionesPlatillos ADD COLUMN Unidad varchar(50) DEFAULT NULL AFTER Tipo');
        }
    } catch (e) {
        console.error('Error ensuring quotes schema:', e);
    }
}

/**
 * Asegura el esquema del módulo de Almacén (control de existencias por sucursal):
 *  - tblAlmacenExistencias: existencia y costo promedio por sucursal × producto;
 *  - tblAlmacenMovimientos: kardex (entradas, salidas y ajustes) por producto;
 *  - columnas EsSalida y FechaAplicacion en tblOrdenesCompra (flujo de órdenes
 *    "fantasma" que se aplican al inventario o se descartan).
 * Idempotente.
 */
async function ensureWarehouseTables(connection: Connection) {
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblAlmacenExistencias\` (
              \`IdSucursal\` int NOT NULL,
              \`IdProducto\` int NOT NULL,
              \`Existencia\` decimal(15,4) NOT NULL DEFAULT 0,
              \`CostoPromedio\` decimal(15,4) NOT NULL DEFAULT 0,
              \`Unidad\` varchar(45) DEFAULT NULL,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdSucursal\`, \`IdProducto\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblAlmacenMovimientos\` (
              \`IdMovimiento\` int NOT NULL AUTO_INCREMENT,
              \`IdSucursal\` int NOT NULL,
              \`IdProducto\` int NOT NULL,
              \`TipoMovimiento\` varchar(10) NOT NULL,
              \`Origen\` varchar(20) NOT NULL,
              \`IdOrdenCompra\` int DEFAULT NULL,
              \`Cantidad\` decimal(15,4) NOT NULL DEFAULT 0,
              \`CostoUnitario\` decimal(15,4) NOT NULL DEFAULT 0,
              \`ExistenciaAnterior\` decimal(15,4) NOT NULL DEFAULT 0,
              \`ExistenciaNueva\` decimal(15,4) NOT NULL DEFAULT 0,
              \`Unidad\` varchar(45) DEFAULT NULL,
              \`Notas\` varchar(255) DEFAULT NULL,
              \`FechaMovimiento\` datetime DEFAULT NULL,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdMovimiento\`),
              KEY \`idx_suc_prod_fecha\` (\`IdSucursal\`, \`IdProducto\`, \`FechaMovimiento\`),
              KEY \`idx_orden\` (\`IdOrdenCompra\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        const [ocCols]: any = await connection.query('SHOW COLUMNS FROM tblOrdenesCompra');
        const ocNames = ocCols.map((c: any) => c.Field);
        if (!ocNames.includes('EsSalida')) {
            await connection.query('ALTER TABLE tblOrdenesCompra ADD COLUMN EsSalida TINYINT NOT NULL DEFAULT 0');
        }
        if (!ocNames.includes('FechaAplicacion')) {
            await connection.query('ALTER TABLE tblOrdenesCompra ADD COLUMN FechaAplicacion datetime DEFAULT NULL');
        }
    } catch (e) {
        console.error('Error ensuring warehouse schema:', e);
    }
}

async function ensurePOSConfigTable(connection: Connection) {
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblPOSConfig\` (
              \`IdPOSConfig\` int NOT NULL AUTO_INCREMENT,
              \`Provider\` varchar(50) NOT NULL DEFAULT 'none',
              \`Url\` varchar(500) DEFAULT NULL,
              \`User\` varchar(255) DEFAULT NULL,
              \`Password\` varchar(255) DEFAULT NULL,
              \`ApiKey\` varchar(500) DEFAULT NULL,
              \`ApiEndpoint\` varchar(500) DEFAULT NULL,
              \`SyncInterval\` varchar(50) DEFAULT 'daily',
              \`AlertsEnabled\` tinyint NOT NULL DEFAULT 1,
              \`AlertEmail\` varchar(255) DEFAULT NULL,
              \`Status\` varchar(50) NOT NULL DEFAULT 'disconnected',
              \`LastSync\` datetime DEFAULT NULL,
              \`FechaAct\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`IdPOSConfig\`)
            ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
        `);
    } catch (e) {
        console.error('Error ensuring POS config schema:', e);
    }
}

/**
 * Creates a connection to the project-specific database.
 * 
 * @param projectId The ID of the project to connect to.
 * @returns A Promise that resolves to a MySQL connection. 
 *          IMPORTANT: The caller is responsible for calling .end() on this connection.
 */
export async function getProjectConnection(projectId: number): Promise<Connection> {
    try {
        // 1. Get project details from main DB
        // Use * to handle inconsistent naming between BDFoodieProjects and BDIntegraProjects
        const [rows] = await pool.query<any[]>(
            'SELECT * FROM tblProyectos WHERE IdProyecto = ?',
            [projectId]
        );

        if (rows.length === 0) {
            throw new Error(`Project with ID ${projectId} not found`);
        }

        const project = rows[0];
        const dbUser = project.UsuarioBD || project.UsarioBD;
        const dbPass = project.PasswordBD || project.PasswdBD;

        // Guardia defensiva: campos de conexión deben estar completos en tblProyectos.
        // Si son NULL el proyecto fue registrado con el INSERT antiguo. Ejecutar:
        //   node scripts/fix-proyectos-nulls.js
        if (!project.BaseDatos || !project.Servidor || !dbUser || !dbPass) {
            throw new Error(
                `Proyecto ${projectId} ("${project.Proyecto || 'desconocido'}") no tiene configuración de BD completa. ` +
                `Verifica BaseDatos, Servidor, UsarioBD y PasswdBD en tblProyectos, ` +
                `o ejecuta: node scripts/fix-proyectos-nulls.js`
            );
        }

        // 2. Create connection to project DB
        const connection = await mysql.createConnection({
            host: project.Servidor,
            user: dbUser,
            password: dbPass,
            database: project.BaseDatos,
            timezone: '-06:00',
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000
        });

        await connection.query("SET time_zone = '-06:00'");

        // 3. Ensure document + acceso/permisos schemas if not verified this session
        if (!verifiedProjects.has(projectId)) {
            await ensureDocumentTablesAndColumns(connection);
            await ensureAccessAndPermissions(connection);
            await ensurePOSConfigTable(connection);
            await ensureQuotesTables(connection);
            await ensureWarehouseTables(connection);

            // Sincronización aditiva con la BD plantilla (FG_Frijoles): replica
            // tablas, columnas y vistas nuevas de la plantilla hacia este proyecto.
            // Solo aplica si el proyecto vive en el mismo servidor que la plantilla.
            const templateHost = process.env.DB_HOST || '74.208.192.90';
            if (project.BaseDatos !== TEMPLATE_DB && project.Servidor === templateHost) {
                try {
                    const report = await syncDatabaseWithTemplate(connection, project.BaseDatos);
                    if (report.tablesCreated.length || report.columnsAdded.length || report.viewsCreated.length) {
                        console.log(
                            `[db-sync] ${project.BaseDatos}: tablas ${report.tablesCreated.length}, ` +
                            `columnas ${report.columnsAdded.length}, vistas ${report.viewsCreated.length}`
                        );
                    }
                    if (report.errors.length) {
                        console.error(`[db-sync] ${project.BaseDatos} errores:`, report.errors);
                    }
                } catch (e) {
                    console.error(`[db-sync] Error sincronizando ${project.BaseDatos} con ${TEMPLATE_DB}:`, e);
                }
            }

            verifiedProjects.add(projectId);
        }

        return connection;
    } catch (error) {
        console.error('Error establishing project database connection:', error);
        throw error;
    }
}
