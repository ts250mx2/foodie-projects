import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/navigation';
import { ToastProvider } from '@/contexts/ToastContext';
import { Inter, Anton, Archivo } from 'next/font/google';
import "../globals.css";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

// Foodie Gurú — titulares display (condensado pesado)
const anton = Anton({
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
  weight: ['400'],
});

// Foodie Gurú — wordmark / subtítulos de marca (variable + itálica)
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
  style: ['normal', 'italic'],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#34b14a',
};

export const metadata = {
  title: 'Foodie Gurú',
  description: 'Administrador master de restaurantes',
  applicationName: 'Foodie Gurú',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default' as const,
    title: 'Foodie Gurú',
  },
  icons: {
    icon: '/icons/icon-192.png',
    shortcut: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
};

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${anton.variable} ${archivo.variable}`}>
      <body className={`${inter.className} antialiased bg-brand-cream text-gray-900`}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
