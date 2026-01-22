import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    locales: ['en', 'es', 'fr', 'de', 'pt', 'it', 'zh', 'ar', 'ru', 'hi', 'bn', 'nl', 'ja'],
    defaultLocale: 'es',
    localePrefix: 'always'
});

export const { Link, redirect, usePathname, useRouter } =
    createNavigation(routing);
