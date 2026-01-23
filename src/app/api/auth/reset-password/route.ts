import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { RowDataPacket } from 'mysql2';

const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(6),
});

export async function POST(request: NextRequest) {
    const connection = await pool.getConnection();
    try {
        const body = await request.json();
        const { token, password } = resetPasswordSchema.parse(body);

        // Verify token and expiry
        // Note: ResetPasswordExpires > NOW()
        const [rows] = await connection.query(
            'SELECT IdUsuario FROM tblUsuarios WHERE ResetPasswordToken = ? AND ResetPasswordExpires > NOW()',
            [token]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 400 });
        }

        const userId = rows[0].IdUsuario;

        // Hash new password
        //const hashedPassword = await bcrypt.hash(password, 10);
        const hashedPassword = password;

        // Update password and clear token
        await connection.query(
            'UPDATE tblUsuarios SET passwd = ?, ResetPasswordToken = NULL, ResetPasswordExpires = NULL WHERE IdUsuario = ?',
            [hashedPassword, userId]
        );

        return NextResponse.json({ success: true, message: 'Password updated successfully' });

    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json({ success: false, message: 'Error resetting password' }, { status: 500 });
    } finally {
        connection.release();
    }
}

