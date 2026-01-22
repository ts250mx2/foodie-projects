import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/navigation';

export default createMiddleware(routing);

export const config = {
    // Match only internationalized pathnames
    matcher: ['/', '/(es|en|fr|de|pt|it|zh|ar|ru|hi|bn|nl|ja)/:path*']
};
