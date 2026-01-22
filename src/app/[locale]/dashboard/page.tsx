import { useTranslations } from 'next-intl';

export default function DashboardPage() {
    const t = useTranslations('HomePage'); // Reusing HomePage keys or Navigation keys

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">{t('title')}</h1>
            <p className="text-gray-600">{t('features.managementDesc')}</p>
        </div>
    );
}
