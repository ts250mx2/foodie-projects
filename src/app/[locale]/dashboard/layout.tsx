'use client';

import Header from '@/components/dashboard/Header';
import Sidebar from '@/components/dashboard/Sidebar';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ReactNode, useState, useEffect } from 'react';

export default function DashboardLayout({
    children,
    params
}: {
    children: ReactNode;
    params: Promise<{ locale: string }>
}) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        // Initialize date filters if not done in this session
        const initialized = sessionStorage.getItem('dateFiltersInitialized');
        if (!initialized) {
            const now = new Date();
            localStorage.setItem('lastSelectedMonth', now.getMonth().toString());
            localStorage.setItem('lastSelectedYear', now.getFullYear().toString());
            
            // Clean up old specific keys to ensure migration to unified keys
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

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <ThemeProvider>
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Header is fixed at top */}
                <Header userName="" onToggleSidebar={toggleSidebar} /> {/* UserName is fetched inside Header from localStorage */}

                <div className="flex flex-1 pt-16">
                    {/* Sidebar is fixed at left */}
                    <Sidebar isCollapsed={isCollapsed} onExpand={() => setIsCollapsed(false)} />

                    {/* Main Content Area */}
                    <main className={`flex-1 ${isCollapsed ? 'ml-20' : 'ml-64'} p-8 transition-all duration-300`}>
                        {children}
                    </main>
                </div>
            </div>
        </ThemeProvider>
    );
}
