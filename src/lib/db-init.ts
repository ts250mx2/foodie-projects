import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { cloneDatabaseFromTemplate, TEMPLATE_DB } from './db-template';

/**
 * Inicializa la BD de un proyecto nuevo clonando la ESTRUCTURA de la BD
 * plantilla (FG_Frijoles): todas sus tablas y sus vistas (vlProductos,
 * vlPlatillos, ...) reapuntadas a las tablas de la BD nueva.
 *
 * Si la plantilla no está disponible, cae al esquema legado project-init.sql.
 */
export async function initializeProjectDatabase(projectName: string) {
    if (!projectName) return;

    // Sanitize project name: replace spaces with underscores, remove special chars
    const sanitizedProjectName = projectName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const dbName = `FG_${sanitizedProjectName}`;

    try {
        console.log(`Clonando estructura de ${TEMPLATE_DB} hacia ${dbName}...`);
        await cloneDatabaseFromTemplate(dbName);
        console.log(`Base de datos ${dbName} creada desde la plantilla ${TEMPLATE_DB}.`);
        return;
    } catch (error) {
        console.error(`No se pudo clonar la plantilla ${TEMPLATE_DB} hacia ${dbName}, usando esquema legado:`, error);
    }

    await initializeFromLegacySchema(dbName);
}

/** Esquema legado: crea la BD y ejecuta src/lib/project-init.sql (fallback). */
async function initializeFromLegacySchema(dbName: string) {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '74.208.192.90',
        user: process.env.DB_USER || 'kyk',
        password: process.env.DB_PASSWORD || 'merkurio',
        port: Number(process.env.DB_PORT) || 3306,
    });

    try {
        console.log(`Creating database ${dbName}...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        console.log(`Database ${dbName} created.`);

        // Now connect to the new database to run the schema
        const projectConnection = await mysql.createConnection({
            host: process.env.DB_HOST || '74.208.192.90',
            user: process.env.DB_USER || 'kyk',
            password: process.env.DB_PASSWORD || 'merkurio',
            database: dbName,
            port: Number(process.env.DB_PORT) || 3306,
            multipleStatements: true // Allow running the script with multiple queries
        });

        try {
            console.log(`Initializing schema for ${dbName}...`);
            const sqlPath = path.join(process.cwd(), 'src', 'lib', 'project-init.sql');
            const sqlScript = fs.readFileSync(sqlPath, 'utf8');

            await projectConnection.query(sqlScript);
            console.log(`Schema initialized for ${dbName}.`);
        } catch (error) {
            console.error(`Error executing schema script for ${dbName}:`, error);
            throw error;
        } finally {
            await projectConnection.end();
        }

    } catch (error) {
        console.error(`Error initializing database ${dbName}:`, error);
        throw error;
    } finally {
        await connection.end();
    }
}
