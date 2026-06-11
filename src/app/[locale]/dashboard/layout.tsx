'use client';

import Header from '@/components/dashboard/Header';
import Sidebar from '@/components/dashboard/Sidebar';
import AiAgent from '@/components/dashboard/AiAgent';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ReactNode, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function DashboardLayout({
    children,
    params
}: {
    children: ReactNode;
    params: Promise<{ locale: string }>
}) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const pathname = usePathname();

    // Detecta móvil (< lg) para alternar entre colapsar (desktop) y drawer (móvil)
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 1023px)');
        const apply = () => setIsMobile(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    // Cierra el drawer móvil al navegar
    useEffect(() => { setMobileNavOpen(false); }, [pathname]);

    useEffect(() => {
        const initialized = sessionStorage.getItem('dateFiltersInitialized');
        if (!initialized) {
            const now = new Date();
            localStorage.setItem('lastSelectedMonth', now.getMonth().toString());
            localStorage.setItem('lastSelectedYear', now.getFullYear().toString());

            const oldKeys = [
                'dashboardSelectedMonth', 'dashboardSelectedYear',
                'lastSelectedMonthInventory', 'lastSelectedYearInventory',
                'lastSelectedMonthSales', 'lastSelectedYearSales',
                'lastSelectedMonthProduction', 'lastSelectedYearProduction',
                'lastSelectedMonthPayroll', 'lastSelectedYearPayroll'
            ];
            oldKeys.forEach(key => localStorage.removeItem(key));

            sessionStorage.setItem('dateFiltersInitialized', 'true');
        }
    }, []);

    // En móvil el botón abre/cierra el drawer; en desktop colapsa la barra.
    const toggleSidebar = () => {
        if (isMobile) setMobileNavOpen(o => !o);
        else setIsCollapsed(c => !c);
    };

    // Páginas de pantalla completa (sin scroll del main): agente y consola de reportes.
    const isAgentePage = pathname?.includes('/dashboard/agente');
    const isConsolePage = pathname?.includes('/dashboard/reportes/nuevo');
    const isFullBleed = isAgentePage || isConsolePage;

    return (
        <ThemeProvider>
            <div className="min-h-screen bg-brand-cream flex flex-col overflow-x-hidden">
                <Header userName="" onToggleSidebar={toggleSidebar} />

                <div className="flex flex-1 pt-16">
                    <Sidebar
                        isCollapsed={isMobile ? false : isCollapsed}
                        mobileOpen={mobileNavOpen}
                        onExpand={() => setIsCollapsed(false)}
                    />

                    {/* Backdrop del drawer en móvil */}
                    {mobileNavOpen && (
                        <div
                            className="fixed inset-0 top-16 z-30 bg-black/40 lg:hidden"
                            onClick={() => setMobileNavOpen(false)}
                            aria-hidden
                        />
                    )}

                    <main className={`flex-1 min-w-0 transition-all duration-300 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'} ${
                        isFullBleed
                            ? `${isConsolePage ? 'p-0' : 'px-4 sm:px-8 pt-4 pb-6'} h-[calc(100vh-4rem)] flex flex-col overflow-hidden`
                            : 'px-4 sm:px-8 pt-4 pb-8 overflow-x-clip'
                    }`}>
                        {children}
                    </main>
                </div>

                {/* Floating agent en todas las páginas excepto agente y consola */}
                {!isFullBleed && <AiAgent mode="floating" />}
            </div>
        </ThemeProvider>
    );
}
