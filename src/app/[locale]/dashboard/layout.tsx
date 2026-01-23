'use client';

import Header from '@/components/dashboard/Header';
import Sidebar from '@/components/dashboard/Sidebar';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ReactNode, useState } from 'react';

export default function DashboardLayout({ children, params }: { children: ReactNode; params: any }) {
    const [isCollapsed, setIsCollapsed] = useState(false);

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
