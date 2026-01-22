import { Link } from '@/i18n/navigation';

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent mb-2">
                        Foodie Guru
                    </h1>
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">
                        Aviso de Privacidad
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Última actualización: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                {/* Content */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700 space-y-6">
                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">1. Responsable del Tratamiento de Datos</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Foodie Guru es responsable del tratamiento de sus datos personales. Nos comprometemos a proteger su privacidad y a cumplir con las leyes aplicables de protección de datos.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">2. Datos Personales Recopilados</h3>
                        <p className="text-gray-700 dark:text-gray-300 mb-2">
                            Recopilamos los siguientes datos personales:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 ml-4">
                            <li>Nombre completo</li>
                            <li>Correo electrónico</li>
                            <li>Número de teléfono</li>
                            <li>País de residencia</li>
                            <li>Nombre del proyecto/empresa</li>
                            <li>Idioma preferido</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">3. Finalidad del Tratamiento</h3>
                        <p className="text-gray-700 dark:text-gray-300 mb-2">
                            Sus datos personales serán utilizados para:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 ml-4">
                            <li>Crear y gestionar su cuenta de usuario</li>
                            <li>Proporcionar acceso a nuestros servicios</li>
                            <li>Enviar comunicaciones relacionadas con el servicio</li>
                            <li>Mejorar nuestros productos y servicios</li>
                            <li>Cumplir con obligaciones legales y regulatorias</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">4. Compartir Información</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            No compartimos, vendemos ni alquilamos su información personal a terceros, excepto cuando sea necesario para proporcionar nuestros servicios, cumplir con la ley o proteger nuestros derechos.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">5. Seguridad de los Datos</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Implementamos medidas de seguridad técnicas, administrativas y físicas apropiadas para proteger sus datos personales contra acceso no autorizado, alteración, divulgación o destrucción.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">6. Sus Derechos</h3>
                        <p className="text-gray-700 dark:text-gray-300 mb-2">
                            Usted tiene derecho a:
                        </p>
                        <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 ml-4">
                            <li>Acceder a sus datos personales</li>
                            <li>Rectificar datos inexactos o incompletos</li>
                            <li>Cancelar sus datos personales</li>
                            <li>Oponerse al tratamiento de sus datos</li>
                            <li>Revocar su consentimiento en cualquier momento</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">7. Retención de Datos</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Conservaremos sus datos personales durante el tiempo necesario para cumplir con las finalidades descritas en este aviso, a menos que la ley requiera o permita un período de retención más largo.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">8. Cookies y Tecnologías Similares</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Utilizamos cookies y tecnologías similares para mejorar su experiencia en nuestro sitio web, analizar el uso del sitio y personalizar el contenido.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">9. Cambios al Aviso de Privacidad</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Nos reservamos el derecho de actualizar este aviso de privacidad en cualquier momento. Le notificaremos sobre cambios significativos publicando el nuevo aviso en nuestro sitio web.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">10. Contacto</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Si tiene preguntas sobre este aviso de privacidad o desea ejercer sus derechos, puede contactarnos a través de los canales proporcionados en nuestro sitio web.
                        </p>
                    </section>

                    <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                            Al utilizar nuestros servicios, usted acepta los términos de este aviso de privacidad.
                        </p>
                    </section>
                </div>

                {/* Back Button */}
                <div className="mt-8 text-center">
                    <Link
                        href="/register"
                        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors"
                    >
                        ← Volver al registro
                    </Link>
                </div>
            </div>
        </div>
    );
}
