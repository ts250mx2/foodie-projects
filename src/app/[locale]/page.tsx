import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Button from '@/components/Button';
import AuthFooter from '@/components/AuthFooter';
import GeoShape from '@/components/brand/GeoShape';

export default function LandingPage() {
  const t = useTranslations('HomePage');

  const features = [
    {
      key: 'management',
      bg: 'var(--color-brand-blue)',
      accent: 'var(--color-brand-yellow)',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      ),
    },
    {
      key: 'analytics',
      bg: 'var(--color-brand-green)',
      accent: 'var(--color-brand-blue)',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      ),
    },
    {
      key: 'support',
      bg: 'var(--color-brand-orange)',
      accent: 'var(--color-brand-yellow)',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      ),
    },
  ] as const;

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-brand-cream">
      {/* ───────────────────── Acentos Bauhaus de fondo ───────────────────── */}
      <GeoShape variant="half-bottom" color="var(--color-brand-green)" size={420} className="absolute -top-24 -left-24 opacity-90" />
      <GeoShape variant="circle" color="var(--color-brand-blue)" size={120} className="absolute top-32 right-[12%] opacity-90 hidden md:block" />
      <GeoShape variant="donut" color="var(--color-brand-orange)" size={110} ring={20} className="absolute top-1/2 left-[6%] opacity-90 hidden lg:block" />
      <GeoShape variant="quarter-tr" color="var(--color-brand-yellow)" size={240} className="absolute top-0 right-0 opacity-90" />

      {/* ───────────────────── Header ───────────────────── */}
      <header className="absolute top-0 z-20 flex w-full items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-md">
            <Image
              src="/images/foodie-guru-logo.png"
              alt="Foodie Gurú"
              width={32}
              height={32}
              priority
              className="object-contain"
            />
          </div>
          <span className="brand-wordmark text-xl text-brand-black hidden sm:inline">
            Foodie Gurú<sup className="text-[0.5em] align-super">®</sup>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <Link href="/login">
            <Button
              tabIndex={-1}
              className="!rounded-xl font-bold uppercase tracking-wide"
              style={{ background: 'var(--color-brand-orange)', color: '#fff' }}
            >
              {t('login')}
            </Button>
          </Link>
        </div>
      </header>

      {/* ───────────────────── Hero ───────────────────── */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 pt-32 text-center">
        <span className="brand-wordmark mb-5 inline-block rounded-full bg-brand-black px-4 py-1.5 text-xs tracking-wide text-brand-cream">
          Ser restaurantero es un arte
        </span>

        <h1 className="brand-display mx-auto max-w-4xl text-5xl text-brand-black md:text-7xl xl:text-8xl">
          {t('title')}
        </h1>

        <p className="mx-auto mt-6 mb-10 max-w-2xl text-lg leading-relaxed text-gray-600 md:text-xl">
          {t('subtitle')}
        </p>

        <Link href="/login">
          <Button
            tabIndex={-1}
            size="lg"
            className="!h-12 !rounded-xl !px-8 !text-base font-bold uppercase tracking-wide"
            style={{ background: 'var(--color-brand-blue)', color: '#fff' }}
          >
            {t('login')} →
          </Button>
        </Link>

        {/* ───────────────────── Features ───────────────────── */}
        <div className="mt-20 grid w-full max-w-6xl grid-cols-1 gap-6 px-4 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.key}
              className="group relative overflow-hidden rounded-3xl p-8 text-left shadow-xl transition-transform duration-300 hover:-translate-y-2"
              style={{ background: f.bg }}
            >
              {/* Acento geométrico de la tarjeta */}
              <GeoShape
                variant="quarter-br"
                color={f.accent}
                size={120}
                className="absolute -bottom-2 -right-2 opacity-90 transition-transform duration-500 group-hover:scale-110"
              />

              <div className="relative z-10">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {f.icon}
                  </svg>
                </div>
                <h3 className="brand-display mb-2 text-2xl text-white">
                  {t(`features.${f.key}`)}
                </h3>
                <p className="text-sm leading-relaxed text-white/85">
                  {t(`features.${f.key}Desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ───────────────────── Footer ───────────────────── */}
      <div className="relative z-10 p-6">
        <AuthFooter />
      </div>
    </div>
  );
}
