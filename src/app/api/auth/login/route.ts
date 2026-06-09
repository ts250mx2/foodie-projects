import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { RowDataPacket } from 'mysql2';
import { getProjectConnection } from '@/lib/dynamic-db';
import { getPermissions } from '@/lib/permissions';

// Validation schema
const loginSchema = z.object({
    identifier: z.string().min(1, 'Correo o teléfono es requerido'),
    password: z.string().min(1, 'La contraseña es requerida'),
});

interface UsuarioRow extends RowDataPacket {
    IdUsuario: number;
    Usuario: string;
    CorreoElectronico: string;
    Telefono: string;
    passwd: string;
    IdProyecto: number;
    Proyecto: string;
    BaseDatos: string;
    Servidor: string;
    UsarioBD: string;
    PasswdBD: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        console.log(body);
        // Validate input
        const validatedData = loginSchema.parse(body);
        const { identifier, password } = validatedData;

        console.log("Valida 1");

        // --- EMPLOYEE LOGIN LOGIC ---
        // If identifier contains an @, it could be an employee login
        if (identifier.includes('@')) {
            const parts = identifier.split('@');
            if (parts.length === 2) {
                const domain = parts[1];
                
                // Query master db for the project matching this domain
                const [projectRows] = await pool.query(
                    'SELECT IdProyecto, Proyecto, BaseDatos, Servidor, UsarioBD, PasswdBD FROM tblProyectos WHERE DominioFG = ?',
                    [domain]
                ) as any[];

                if (projectRows.length > 0) {
                    const project = projectRows[0];
                    let connection;
                    
                    try {
                        connection = await getProjectConnection(project.IdProyecto);
                        
                        // Check tblEmpleados using plain text password matching
                        const [empRows] = await connection.query(
                            'SELECT IdEmpleado, Empleado, CorreoElectronico, EsAdministrador FROM tblEmpleados WHERE Login = ? AND Passwd = ? AND Status = 0',
                            [identifier, password]
                        ) as any[];

                        if (empRows.length > 0) {
                            const employee = empRows[0];
                            const permissions = await getPermissions(connection, employee.IdEmpleado);
                            
                            return NextResponse.json({
                                success: true,
                                message: 'Login exitoso (Empleado)',
                                isEmployee: true,
                                user: {
                                    idUsuario: employee.IdEmpleado, // Mapping ID for frontend consistency
                                    nombreUsuario: employee.Empleado,
                                    correoElectronico: employee.CorreoElectronico || identifier,
                                    isAdmin: employee.EsAdministrador === 1
                                },
                                project: {
                                    idProyecto: project.IdProyecto,
                                    nombre: project.Proyecto,
                                    baseDatos: project.BaseDatos,
                                    servidor: project.Servidor,
                                    usuarioBD: project.UsarioBD,
                                    passwdBD: project.PasswdBD
                                },
                                permissions
                            });
                        }
                    } catch (err) {
                        console.error('Error during employee login database connection:', err);
                        // If connection fails, it will drop down to regular user check or error
                    } finally {
                        if (connection) await connection.end();
                    }
                }
            }
        }
        // --- END EMPLOYEE LOGIN LOGIC ---

        // Query user by email OR phone
        // Query user and project details by email OR phone
        const [rows] = await pool.query(
            `SELECT 
                u.IdUsuario, 
                u.Usuario, 
                u.CorreoElectronico, 
                u.Telefono, 
                u.passwd,
                p.IdProyecto,
                p.Proyecto,
                p.BaseDatos,
                p.Servidor,
                p.UsarioBD,
                p.PasswdBD
            FROM tblUsuarios u
            LEFT JOIN tblProyectosUsuarios pu ON u.IdUsuario = pu.IdUsuario
            LEFT JOIN tblProyectos p ON pu.IdProyecto = p.IdProyecto
            WHERE u.CorreoElectronico = ?`,
            [identifier]
        ) as any[];

        console.log("Valida 2");

        console.log((rows as any).length);
        if ((rows as any).length === 0) {
            return NextResponse.json(
                { success: false, message: 'Usuario no encontrado' },
                { status: 401 }
            );
        }

        const user = (rows as any)[0];

        // Hash password
        // const hashedPassword = await bcrypt.hash(password, 10);
        // Verify password
        const isPasswordValid = password === user.passwd;

        console.log(user.passwd);
        console.log(password);
        console.log(isPasswordValid);

        if (!isPasswordValid) {
            return NextResponse.json(
                { success: false, message: 'Credenciales inválidas' },
                { status: 401 }
            );
        }

        // Return success with user data and project info
        // Note: Sending DB credentials to client is risky but requested for context.
        // In a real production app, we would keep these server-side or encrypted.
        return NextResponse.json({
            success: true,
            message: 'Login exitoso',
            user: {
                idUsuario: user.IdUsuario,
                nombreUsuario: user.Usuario, // Mapped correctly from u.Usuario
                correoElectronico: user.CorreoElectronico,
            },
            project: {
                idProyecto: user.IdProyecto,
                nombre: user.Proyecto,
                baseDatos: user.BaseDatos,
                servidor: user.Servidor,
                usuarioBD: user.UsarioBD,
                passwdBD: user.PasswdBD
            }
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, message: 'Datos inválidos', errors: error.issues },
                { status: 400 }
            );
        }

        console.error('Login error:', error);
        return NextResponse.json(
            { success: false, message: 'Error en el servidor' },
            { status: 500 }
        );
    }
}

