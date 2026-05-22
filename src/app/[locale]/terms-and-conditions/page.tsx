import { Link } from '@/i18n/navigation';

export default function TermsAndConditionsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-500 to-pink-500 bg-clip-text text-transparent mb-2">
                        Foodie Guru
                    </h1>
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">
                        Términos y Condiciones
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Última actualización: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                {/* Content */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700 space-y-6">
                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">1. Aceptación de los Términos</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Al registrarse y/o utilizar Foodie Guru (la &quot;Plataforma&quot;), usted acepta cumplir y quedar legalmente vinculado por estos Términos y Condiciones. Si no está de acuerdo con alguno de los términos aquí establecidos, deberá abstenerse de usar la Plataforma.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">2. Descripción del Servicio</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Foodie Guru es una plataforma de gestión integral para restaurantes y operaciones de alimentos que permite el control de costeo, inventarios, recetas, compras, ventas, nómina y análisis de rentabilidad.
                        </p>
                    </section>

                    <section className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-5 rounded-r-lg">
                        <h3 className="text-xl font-semibold text-amber-900 dark:text-amber-200 mb-3">3. Servicio de Suscripción Mensual</h3>
                        <p className="text-amber-900 dark:text-amber-100 mb-3 font-medium">
                            Foodie Guru se ofrece bajo un esquema de <strong>suscripción mensual recurrente</strong>. El acceso a la Plataforma está condicionado al pago oportuno de la cuota mensual correspondiente.
                        </p>
                        <ul className="list-disc list-inside text-amber-900 dark:text-amber-100 space-y-2 ml-2">
                            <li>El servicio se factura de forma mensual, por adelantado, en la fecha de aniversario de la suscripción.</li>
                            <li>El usuario es responsable de mantener la información de pago actualizada y asegurar que los pagos se procesen correctamente.</li>
                            <li>Las cuotas pagadas no son reembolsables, salvo disposición legal en contrario.</li>
                        </ul>
                    </section>

                    <section className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-5 rounded-r-lg">
                        <h3 className="text-xl font-semibold text-red-900 dark:text-red-200 mb-3">4. Suspensión por Falta de Pago</h3>
                        <p className="text-red-900 dark:text-red-100 mb-3 font-medium">
                            En caso de que la cuota mensual <strong>no sea cubierta en su fecha de vencimiento</strong>, Foodie Guru se reserva el derecho de:
                        </p>
                        <ul className="list-disc list-inside text-red-900 dark:text-red-100 space-y-2 ml-2">
                            <li><strong>Suspender automáticamente</strong> el acceso del usuario a la Plataforma y a todas sus funcionalidades.</li>
                            <li>Mantener la suspensión vigente <strong>hasta que el pago pendiente sea liquidado en su totalidad</strong>.</li>
                            <li>Conservar la información y datos del usuario durante el período de suspensión, sin garantía de disponibilidad operativa.</li>
                            <li>Restaurar el acceso completo al servicio una vez confirmado el pago correspondiente, sin necesidad de trámite adicional por parte del usuario.</li>
                        </ul>
                        <p className="text-red-900 dark:text-red-100 mt-3 text-sm italic">
                            La suspensión por falta de pago no constituye terminación del contrato y no exime al usuario de las obligaciones de pago acumuladas durante el período de suspensión.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">5. Cancelación del Servicio</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            El usuario podrá cancelar su suscripción en cualquier momento. La cancelación tendrá efecto al finalizar el período mensual ya pagado; no se generarán cargos adicionales a partir de ese momento. Tras la cancelación, los datos podrán conservarse por un período razonable conforme a nuestro Aviso de Privacidad.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">6. Obligaciones del Usuario</h3>
                        <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 ml-4">
                            <li>Proporcionar información veraz y mantenerla actualizada.</li>
                            <li>Mantener la confidencialidad de sus credenciales de acceso.</li>
                            <li>No utilizar la Plataforma para fines ilegales o no autorizados.</li>
                            <li>No intentar acceder a áreas restringidas del sistema ni vulnerar medidas de seguridad.</li>
                            <li>Cubrir oportunamente las cuotas mensuales correspondientes.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">7. Propiedad Intelectual</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Todo el contenido, software, marcas y materiales presentes en la Plataforma son propiedad de Foodie Guru o de sus licenciantes y están protegidos por las leyes de propiedad intelectual aplicables. La suscripción otorga al usuario una licencia limitada, no exclusiva e intransferible para utilizar la Plataforma.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">8. Limitación de Responsabilidad</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Foodie Guru se proporciona &quot;tal cual&quot; y &quot;según disponibilidad&quot;. No garantizamos que el servicio sea ininterrumpido o libre de errores. En la máxima medida permitida por la ley, Foodie Guru no será responsable de daños indirectos, incidentales, especiales o consecuenciales derivados del uso o imposibilidad de uso de la Plataforma.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">9. Modificaciones a los Términos</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Nos reservamos el derecho de modificar estos Términos y Condiciones en cualquier momento. Los cambios entrarán en vigor al publicarse en la Plataforma. El uso continuado del servicio después de la publicación de los cambios constituye aceptación de los nuevos términos.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">10. Ley Aplicable</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Estos Términos y Condiciones se rigen por las leyes aplicables en el lugar donde Foodie Guru tiene su domicilio legal. Cualquier controversia se resolverá ante los tribunales competentes de dicha jurisdicción.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">11. Contacto</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Para preguntas, solicitudes o aclaraciones relativas a estos Términos y Condiciones, puede contactarnos a través de los canales de soporte habilitados en la Plataforma.
                        </p>
                    </section>

                    <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                            Al registrarse y utilizar Foodie Guru, usted reconoce haber leído, comprendido y aceptado estos Términos y Condiciones, incluyendo el esquema de suscripción mensual y las condiciones de suspensión por falta de pago.
                        </p>
                    </section>
                </div>

                {/* Back Button */}
                <div className="mt-8 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors"
                    >
                        ← Volver al inicio
                    </Link>
                </div>
            </div>
        </div>
    );
}
