import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: 'ts250mx@yahoo.com',
        pass: 'gefxthukqovqzltm',
    },
});

export async function sendVerificationEmail(to: string, token: string, locale: string = 'es') {
    const activationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/${locale}/activate?token=${token}`;

    const templates: Record<string, any> = {
        es: {
            subject: 'Activa tu cuenta en Foodie Guru',
            title: '¡Bienvenido a Foodie Guru!',
            greeting: 'Gracias por registrarte. Para comenzar a usar tu cuenta, por favor verifica tu correo electrónico haciendo clic en el siguiente enlace:',
            button: 'ACTIVAR CUENTA',
            fallback: 'Si el botón no funciona, puedes copiar y pegar el siguiente enlace en tu navegador:',
            ignore: 'Si no creaste esta cuenta, puedes ignorar este correo.'
        },
        en: {
            subject: 'Activate your Foodie Guru account',
            title: 'Welcome to Foodie Guru!',
            greeting: 'Thanks for signing up. To start using your account, please verify your email address by clicking the link below:',
            button: 'ACTIVATE ACCOUNT',
            fallback: 'If the button does not work, you can copy and paste the following link into your browser:',
            ignore: 'If you did not create this account, you can ignore this email.'
        }
    };

    const t = templates[locale] || templates['es'];

    const mailOptions = {
        from: '"Foodie Guru" <ts250mx@yahoo.com>',
        to: to,
        subject: t.subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #f97316;">${t.title}</h1>
                <p>${t.greeting}</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${activationLink}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">${t.button}</a>
                </div>
                <p>${t.fallback}</p>
                <p style="color: #666;">${activationLink}</p>
                <p>${t.ignore}</p>
            </div>
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Verification email sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending verification email:', error);
        return false;
    }
}

// Function to send password reset email
export async function sendPasswordResetEmail(to: string, token: string, locale: string = 'es') {
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/${locale}/reset-password?token=${token}`;

    const templates: Record<string, any> = {
        es: {
            subject: 'Restablecer contraseña - Foodie Guru',
            title: 'Recuperación de Contraseña',
            greeting: 'Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva:',
            button: 'RESTABLECER CONTRASEÑA',
            fallback: 'Si el botón no funciona, copia y pega este enlace:',
            expiry: 'Este enlace expirará en 1 hora.',
            ignore: 'Si no solicitaste esto, ignora este correo.'
        },
        en: {
            subject: 'Reset Password - Foodie Guru',
            title: 'Password Reset',
            greeting: 'You requested a password reset. Click the link below to create a new one:',
            button: 'RESET PASSWORD',
            fallback: 'If the button does not work, copy and paste this link:',
            expiry: 'This link expires in 1 hour.',
            ignore: 'If you did not request this, please ignore this email.'
        }
    };

    const t = templates[locale] || templates['es'];

    const mailOptions = {
        from: '"Foodie Guru" <ts250mx@yahoo.com>',
        to: to,
        subject: t.subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #f97316;">${t.title}</h1>
                <p>${t.greeting}</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">${t.button}</a>
                </div>
                <p>${t.fallback}</p>
                <p style="color: #666;">${resetLink}</p>
                <p><strong>${t.expiry}</strong></p>
                <p>${t.ignore}</p>
            </div>
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Reset password email sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending reset password email:', error);
        return false;
    }
}
