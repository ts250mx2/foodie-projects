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
    const pathname = usePathname();

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

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);

    // Páginas de pantalla completa (sin scroll del main): agente y consola de reportes.
    const isAgentePage = pathname?.includes('/dashboard/agente');
    const isConsolePage = pathname?.includes('/dashboard/reportes/nuevo');
    const isFullBleed = isAgentePage || isConsolePage;

    return (
        <ThemeProvider>
            <div className="min-h-screen bg-brand-cream flex flex-col">
                <Header userName="" onToggleSidebar={toggleSidebar} />

                <div className="flex flex-1 pt-16">
                    <Sidebar isCollapsed={isCollapsed} onExpand={() => setIsCollapsed(false)} />

                    <main className={`flex-1 ${isCollapsed ? 'ml-20' : 'ml-64'} transition-all duration-300 ${
                        isFullBleed
                            ? `${isConsolePage ? 'p-0' : 'px-8 pt-4 pb-6'} h-[calc(100vh-4rem)] flex flex-col overflow-hidden`
                            : 'px-8 pt-4 pb-8'
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
