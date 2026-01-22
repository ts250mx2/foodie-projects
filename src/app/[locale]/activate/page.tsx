import { getTranslations } from 'next-intl/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { Link } from '@/i18n/navigation';
import { initializeProjectDatabase } from '@/lib/db-init';

interface ActivatePageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
    params: Promise<{ locale: string }>;
}

export default async function ActivatePage({ searchParams, params }: ActivatePageProps) {
    const { token } = await searchParams;
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Activate' });
    const tAuth = await getTranslations({ locale, namespace: 'Auth' });

    if (!token || typeof token !== 'string') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="max-w-md w-full p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
                    <h1 className="text-2xl font-bold text-red-500 mb-4">{t('invalidTokenTitle')}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{t('invalidTokenDesc')}</p>
                    <Link href="/" className="text-orange-500 hover:text-orange-600 font-medium">{t('backToHome')}</Link>
                </div>
            </div>
        );
    }

    let success = false;
    let message = '';
    let userData = null;

    try {
        const connection = await pool.getConnection();

        try {
            // Find the project-user link by token
            const [rows] = await connection.query<RowDataPacket[]>(
                `SELECT pu.IdProyecto, pu.IdUsuario, u.Usuario, u.CorreoElectronico, u.Telefono, p.Proyecto 
                 FROM tblProyectosUsuarios pu
                 JOIN tblUsuarios u ON pu.IdUsuario = u.IdUsuario
                 JOIN tblProyectos p ON pu.IdProyecto = p.IdProyecto
                 WHERE pu.VerificationToken = ?`,
                [token]
            );

            if (rows.length === 0) {
                message = t('invalidTokenOrUsed');
            } else {
                const user = rows[0];

                // Activate account
                await connection.query(
                    'UPDATE tblProyectosUsuarios SET CuentaActiva = 1, FechaActivacion = NOW(), VerificationToken = NULL WHERE VerificationToken = ?',
                    [token]
                );

                // Initialize Project Database (fire and forget or wait? safest to wait to report error if any)
                await initializeProjectDatabase(user.Proyecto);

                success = true;
                userData = user;
                message = t('activationSuccess');
            }

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Activation error:', error);
        message = t('activationError');
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
            <div className="max-w-xl w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
                <div className="text-center mb-8">
                    <h1 className={`text-3xl font-bold mb-2 ${success ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {success ? t('welcome') : t('errorTitle')}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300">{message}</p>
                </div>

                {success && userData && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-700/50 rounded-xl p-6 border border-gray-100 dark:border-gray-600 shadow-sm">
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-600 pb-2">
                                {t('accountDetails')}
                            </h2>
                            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{tAuth('user')}</dt>
                                    <dd className="mt-1 text-base font-semibold text-gray-900 dark:text-white">{userData.Usuario}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{tAuth('project')}</dt>
                                    <dd className="mt-1 text-base font-semibold text-gray-900 dark:text-white">{userData.Proyecto}</dd>
                                </div>
                                <div className="sm:col-span-2">
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{tAuth('email')}</dt>
                                    <dd className="mt-1 text-base font-semibold text-gray-900 dark:text-white">{userData.CorreoElectronico}</dd>
                                </div>
                                <div className="sm:col-span-2">
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{tAuth('phone')}</dt>
                                    <dd className="mt-1 text-base font-semibold text-gray-900 dark:text-white">{userData.Telefono}</dd>
                                </div>
                            </dl>
                        </div>

                        <div className="text-center pt-4">
                            <Link
                                href="/login"
                                className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                            >
                                {t('goToLogin')}
                            </Link>
                        </div>
                    </div>
                )}

                {!success && (
                    <div className="text-center mt-6">
                        <Link href="/register" className="text-orange-500 hover:text-orange-600 font-medium hover:underline">
                            {t('tryRegisterAgain')}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
