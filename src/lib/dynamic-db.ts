import mysql from 'mysql2/promise';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

interface ProjectConfig extends RowDataPacket {
    BaseDatos: string;
    Servidor: string;
    UsarioBD: string;
    PasswdBD: string;
}

/**
 * Creates a connection to the project-specific database.
 * 
 * @param projectId The ID of the project to connect to.
 * @returns A Promise that resolves to a MySQL connection. 
 *          IMPORTANT: The caller is responsible for calling .end() on this connection.
 */
export async function getProjectConnection(projectId: number) {
    try {
        // 1. Get project details from main DB
        const [rows] = await pool.query<ProjectConfig[]>(
            'SELECT BaseDatos, Servidor, UsarioBD, PasswdBD FROM tblProyectos WHERE IdProyecto = ?',
            [projectId]
        );

        if (rows.length === 0) {
            throw new Error(`Project with ID ${projectId} not found`);
        }

        const config = rows[0];

        // 2. Create connection to project DB
        const connection = await mysql.createConnection({
            host: config.Servidor,
            user: config.UsarioBD, // Note: DB column has typo 'UsarioBD'
            password: config.PasswdBD,
            database: config.BaseDatos,
        });

        return connection;
    } catch (error) {
        console.error('Error establishing project database connection:', error);
        throw error;
    }
}
