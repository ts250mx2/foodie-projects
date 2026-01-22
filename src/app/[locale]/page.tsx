import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Button from '@/components/Button';

export default function LandingPage() {
  const t = useTranslations('HomePage');

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
        <div className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
          Foodie Guru
        </div>

        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <Link href="/login">
            <Button tabIndex={-1}>{t('login')}</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 text-center mt-16 relative overflow-hidden">

        {/* Decorative Blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-300/30 dark:bg-orange-500/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-300/30 dark:bg-purple-500/10 rounded-full blur-3xl -z-10 animate-pulse delay-1000"></div>

        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 bg-clip-text text-transparent drop-shadow-sm">
          {t('title')}
        </h1>

        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-2xl mb-12 leading-relaxed">
          {t('subtitle')}
        </p>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full px-4">
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700 hover:transform hover:-translate-y-2 transition-all duration-300">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center mb-4 mx-auto text-orange-600 dark:text-orange-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{t('features.management')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('features.managementDesc')}</p>
          </div>

          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700 hover:transform hover:-translate-y-2 transition-all duration-300">
            <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/50 rounded-lg flex items-center justify-center mb-4 mx-auto text-pink-600 dark:text-pink-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{t('features.analytics')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('features.analyticsDesc')}</p>
          </div>

          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-white/20 dark:border-gray-700 hover:transform hover:-translate-y-2 transition-all duration-300">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mb-4 mx-auto text-purple-600 dark:text-purple-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{t('features.support')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('features.supportDesc')}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
