import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Foodie Gurú',
        short_name: 'Foodie Gurú',
        description: 'Administrador master de restaurantes',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f5efe1',
        theme_color: '#34b14a',
        lang: 'es',
        dir: 'ltr',
        icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    };
}
