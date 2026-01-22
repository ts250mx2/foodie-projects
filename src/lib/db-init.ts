import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

export async function initializeProjectDatabase(projectName: string) {
    if (!projectName) return;

    // Sanitize project name: replace spaces with underscores, remove special chars
    const sanitizedProjectName = projectName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const dbName = `FG_${sanitizedProjectName}`;

    // Create a connection without selecting a database first
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'hlsistemas.com',
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
            host: process.env.DB_HOST || 'hlsistemas.com',
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
