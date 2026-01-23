import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ResultSetHeader } from 'mysql2';
import crypto from 'crypto';
import { sendVerificationEmail } from '@/lib/email';

// Validation schema
const registerSchema = z.object({
    nombreProyecto: z.string().min(1, 'Nombre del proyecto es requerido'),
    nombreUsuario: z.string().min(1, 'Nombre de usuario es requerido'),
    correoElectronico: z.string().email('Correo electrónico inválido'),
    telefono: z.string().min(10, 'Teléfono debe tener al menos 10 dígitos'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    repetirPassword: z.string(),
    pais: z.string().min(1, 'País es requerido'),
    idioma: z.string().min(1, 'Idioma es requerido'),
    locale: z.string().optional(),
}).refine((data) => data.password === data.repetirPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['repetirPassword'],
});

export async function POST(request: NextRequest) {
    const connection = await pool.getConnection();

    try {
        const body = await request.json();

        // Validate input
        const validatedData = registerSchema.parse(body);
        const {
            nombreProyecto,
            nombreUsuario,
            correoElectronico,
            telefono,
            password,
            pais,
            idioma,
            locale,
        } = validatedData;

        // Start transaction
        await connection.beginTransaction();

        // Check if email or phone already exists
        const [existingUsers] = await connection.query(
            'SELECT IdUsuario FROM tblUsuarios WHERE CorreoElectronico = ? OR Telefono = ?',
            [correoElectronico, telefono]
        ) as any[];

        if (Array.isArray(existingUsers) && existingUsers.length > 0) {
            await connection.rollback();
            return NextResponse.json(
                { success: false, message: 'El correo electrónico o teléfono ya están registrados' },
                { status: 409 }
            );
        }

        // Hash password
        //const hashedPassword = await bcrypt.hash(password, 10);
        const hashedPassword = password;

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Insert into tblUsuarios
        const [userResult] = await connection.query(
            'INSERT INTO tblUsuarios (Usuario, CorreoElectronico, Telefono, passwd, FechaAct, Status) VALUES (?, ?, ?, ?, Now(), 0)',
            [nombreUsuario, correoElectronico, telefono, hashedPassword]
        ) as any;

        const idUsuario = (userResult as any).insertId;

        // Insert into tblProyectos
        const [projectResult] = await connection.query(
            'INSERT INTO tblProyectos (Proyecto, Pais, Idioma, FechaAct, Status) VALUES (?, ?, ?, Now(), 0)',
            [nombreProyecto, pais, idioma]
        ) as any;

        const idProyecto = (projectResult as any).insertId;

        // Insert into tblProyectosUsuarios (link user and project)
        await connection.query(
            'INSERT INTO tblProyectosUsuarios (IdProyecto, IdUsuario, FechaAct, VerificationToken) VALUES (?, ?, Now(), ?)',
            [idProyecto, idUsuario, verificationToken]
        );

        // Commit transaction
        await connection.commit();

        // Send verification email (non-blocking)
        sendVerificationEmail(correoElectronico, verificationToken, locale);

        return NextResponse.json({
            success: true,
            message: 'Registro exitoso',
            user: {
                idUsuario,
                nombreUsuario,
                correoElectronico,
            },
            proyecto: {
                idProyecto,
                nombreProyecto,
            },
        });

    } catch (error) {
        // Rollback transaction on error
        await connection.rollback();

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, message: 'Datos inválidos', errors: error.issues },
                { status: 400 }
            );
        }

        console.error('Registration error:', error);
        return NextResponse.json(
            { success: false, message: 'Error en el servidor' },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

