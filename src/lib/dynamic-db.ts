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

        // 2. Create connection to project DB
        const connection = await mysql.createConnection({
            host: project.Servidor,
            user: dbUser,
            password: dbPass,
            database: project.BaseDatos,
        });

        return connection;
    } catch (error) {
        console.error('Error establishing project database connection:', error);
        throw error;
    }
}
