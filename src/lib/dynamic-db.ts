import mysql, { Connection } from 'mysql2/promise';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

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
    } catch (e) {
        console.error('Error ensuring access/permissions schema:', e);
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
            verifiedProjects.add(projectId);
        }

        return connection;
    } catch (error) {
        console.error('Error establishing project database connection:', error);
        throw error;
    }
}
