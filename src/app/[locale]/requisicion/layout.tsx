import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
    title: 'Requisición de insumos',
    // La liga es la credencial: que no la indexe nadie.
    robots: { index: false, follow: false },
};

/**
 * La tablet vive en modo kiosco: sin zoom accidental al teclear y usando toda
 * la altura real de la pantalla (viewport-fit para tablets con notch).
 */
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
    themeColor: '#eef1f5',
};

export default function RequisitionLayout({ children }: { children: React.ReactNode }) {
    return children;
}
