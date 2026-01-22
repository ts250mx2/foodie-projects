import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import crypto from 'crypto';
import { z } from 'zod';
import { sendPasswordResetEmail } from '@/lib/email';
import { RowDataPacket } from 'mysql2';

const forgotPasswordSchema = z.object({
    email: z.string().email(),
    locale: z.string().optional(),
});

export async function POST(request: NextRequest) {
    const connection = await pool.getConnection();
    try {
        const body = await request.json();
        const { email, locale } = forgotPasswordSchema.parse(body);

        // Check if user exists
        const [rows] = await connection.query<RowDataPacket[]>(
            'SELECT IdUsuario FROM tblUsuarios WHERE CorreoElectronico = ?',
            [email]
        );

        if (rows.length > 0) {
            // Generate token
            const token = crypto.randomBytes(32).toString('hex');
            // Expires in 1 hour
            const expires = new Date(Date.now() + 3600000);

            // Save token and expiry
            await connection.query(
                'UPDATE tblUsuarios SET ResetPasswordToken = ?, ResetPasswordExpires = ? WHERE CorreoElectronico = ?',
                [token, expires, email]
            );

            // Send email
            await sendPasswordResetEmail(email, token, locale);
        }

        // Always return success to prevent email enumeration
        return NextResponse.json({ success: true, message: 'If the email exists, a reset link has been sent.' });

    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json({ success: false, message: 'Error processing request' }, { status: 500 });
    } finally {
        connection.release();
    }
}
