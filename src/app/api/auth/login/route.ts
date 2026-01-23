import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { RowDataPacket } from 'mysql2';

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
        );

        console.log(rows.length);
        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, message: 'Usuario no encontrado' },
                { status: 401 }
            );
        }

        const user = rows[0];

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

