import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import GeoShape from '@/components/brand/GeoShape';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// Paleta fija (igual que en login/page.tsx)
const BLUE   = '#3b3be8';
const GREEN  = '#34b14a';
const ORANGE = '#f4481e';
const YELLOW = '#f8e14c';
const CREAM  = '#f5efe1';

export default function LandingPage() {
  const t = useTranslations('HomePage');

  const features = [
    {
      key: 'management',
      bg: BLUE,
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      ),
    },
    {
      key: 'analytics',
      bg: GREEN,
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      ),
    },
    {
      key: 'support',
      bg: ORANGE,
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
          d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      ),
    },
  ] as const;

  return (
    <div className="flex flex-col min-h-screen md:h-screen overflow-y-auto md:overflow-hidden" style={{ backgroundColor: CREAM }}>

      {/* ═══════════════════════ HERO (fondo naranja, 42% alto) ═══════════════════════ */}
      <section className="relative overflow-hidden flex flex-col items-center justify-center text-center min-h-[42vh] md:min-h-0 md:h-[42%] py-12 md:py-0"
        style={{ backgroundColor: ORANGE }}>

        {/* ── Language Switcher top-right ── */}
        <div className="absolute top-4 right-4 z-20 text-white">
          <LanguageSwitcher />
        </div>

        {/* ── Logo top-left ── */}
        <div className="absolute top-0 left-0 z-20 rounded-br-[3.5rem] px-8 py-4 shadow-md flex items-center justify-center"
          style={{ backgroundColor: CREAM }}>
          <Image
            src="/images/foodie-solutions-logo.png"
            alt="Foodie Solutions"
            width={130}
            height={52}
            priority
            className="h-auto object-contain"
          />
        </div>

        {/* ── Badge pill top-center (oculto en móvil para no chocar con logo/idioma) ── */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 hidden md:block">
          <span className="font-brand inline-block rounded-full bg-black px-6 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
            Ser restaurantero es un arte
          </span>
        </div>

        {/* ── Formas geométricas IZQUIERDA ── */}
        {/* Semicírculo azul (mitad derecha visible) */}
        <div className="pointer-events-none absolute z-10 hidden lg:block"
          style={{ left: '-90px', top: '50%', transform: 'translateY(-50%)' }}>
          <GeoShape variant="half-right" color={BLUE} size={200} />
        </div>
        {/* Cuarto de círculo amarillo — delante del azul, abajo */}
        <div className="pointer-events-none absolute z-10 hidden lg:block"
          style={{ left: '22px', bottom: '10px' }}>
          <GeoShape variant="quarter-tr" color={YELLOW} size={100} />
        </div>

        {/* ── Formas geométricas DERECHA ── */}
        {/* Cuadro azul en la esquina superior derecha con el semicírculo (25%) amarillo adentro */}
        <div className="pointer-events-none absolute top-0 right-0 z-10 hidden lg:block w-[160px] h-[160px] overflow-hidden"
          style={{ backgroundColor: BLUE }}>
          <GeoShape variant="quarter-bl" color={YELLOW} size={130} className="absolute top-0 right-0" />
        </div>

        {/* ── Texto hero ── */}
        <div className="relative z-20 px-6 mt-8">
          <h1 className="brand-display text-4xl md:text-5xl xl:text-6xl 2xl:text-7xl text-white leading-tight mt-2 whitespace-pre-line" style={{ color: '#ffffff' }}>
            {t('title')}
          </h1>
          <p className="font-brand mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white md:text-xs" style={{ color: '#ffffff' }}>
            {t('subtitle')}
          </p>
        </div>
      </section>

      {/* ═══════════════════════ BOTTOM (fondo crema, 52% alto) ═══════════════════════ */}
      <section className="relative flex flex-col items-center gap-8 md:gap-0 md:flex-[1_1_52%] md:justify-between px-6 pt-8 md:pt-5 pb-8 md:pb-2 md:overflow-hidden"
        style={{ backgroundColor: CREAM }}>

        {/* Cuarto verde — esquina inferior izquierda */}
        <div className="pointer-events-none absolute bottom-0 left-0 z-0 hidden lg:block">
          <GeoShape variant="quarter-tr" color={GREEN} size={140} />
        </div>

        {/* Botón INGRESAR */}
        <Link href="/login" className="relative z-10">
          <span className="font-brand inline-block rounded-full px-8 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition hover:opacity-90"
            style={{ backgroundColor: BLUE, color: '#ffffff' }}>
            {t('login')} →
          </span>
        </Link>

        {/* Feature cards (compactas para no rebasar altura) */}
        <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4 md:my-auto">
          {features.map((f) => (
            <div
              key={f.key}
              className="group relative overflow-hidden rounded-2xl p-5 text-left shadow-md transition-transform duration-300 hover:-translate-y-0.5"
              style={{ backgroundColor: f.bg }}
            >
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#ffffff' }}>
                  {f.icon}
                </svg>
              </div>
              <h3 className="brand-display mb-1 text-base md:text-lg text-white" style={{ color: '#ffffff' }}>
                {t(`features.${f.key}`)}
              </h3>
              <p className="text-[12px] leading-normal text-white" style={{ color: '#ffffff' }}>
                {t(`features.${f.key}Desc`)}
              </p>
            </div>
          ))}
        </div>

        {/* Powered by — esquina inferior derecha (muy compacto) */}
        <div className="relative z-10 self-end text-right" style={{ transform: 'translateY(-2px)' }}>
          <p className="font-brand text-[8px] font-bold uppercase tracking-widest text-gray-400">
            Powered by:
          </p>
          <Image
            src="/images/foodie-guru-logo.png"
            alt="Foodie Gurú"
            width={75}
            height={32}
            className="ml-auto h-auto object-contain"
          />
          <p className="font-brand text-[8px] font-bold uppercase tracking-widest text-gray-400 mt-0.5" style={{ color: '#9ca3af' }}>
            Despacho de consultoría de restaurantes
          </p>
        </div>
      </section>

      {/* ═══════════════════════ FOOTER azul (6% alto) ═══════════════════════ */}
      <footer className="shrink-0 py-2.5 md:h-[6%] flex items-center justify-center" style={{ backgroundColor: BLUE }}>
        <p className="font-brand text-center text-[10px] font-bold uppercase tracking-widest text-white">
          Derechos reservados Foodie Gurú Consulting 2026.
        </p>
      </footer>
    </div>
  );
}
