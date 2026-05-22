import { Link } from '@/i18n/navigation';

export default function AuthFooter() {
    const year = new Date().getFullYear();

    return (
        <footer className="mt-8 text-center space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <Link
                    href="/privacy-policy"
                    className="hover:text-primary-500 dark:hover:text-primary-400 transition-colors font-medium"
                >
                    Aviso de Privacidad
                </Link>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <Link
                    href="/terms-and-conditions"
                    className="hover:text-primary-500 dark:hover:text-primary-400 transition-colors font-medium"
                >
                    Términos y Condiciones
                </Link>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
                © {year} Foodie Guru. Todos los derechos reservados.
            </p>
        </footer>
    );
}
