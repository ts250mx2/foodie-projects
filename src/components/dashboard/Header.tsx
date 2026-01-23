'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface HeaderProps {
    userName: string;
    onLogout?: () => void;
    onToggleSidebar?: () => void;
}

export default function Header({ userName: initialUserName, onLogout, onToggleSidebar }: HeaderProps) {
    const t = useTranslations('Navigation');
    const router = useRouter();
    const { colors } = useTheme();
    const [userName, setUserName] = useState(initialUserName || '');
    const [projectTitle, setProjectTitle] = useState('');
    const [projectLogo, setProjectLogo] = useState('');
    const [projectName, setProjectName] = useState('');

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const storedProject = localStorage.getItem('project');

        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                if (user.nombreUsuario) {
                    setUserName(user.nombreUsuario);
                }
            } catch (e) {
                console.error('Error parsing user data', e);
            }
        }

        if (storedProject) {
            try {
                const project = JSON.parse(storedProject);
                if (project.nombre) {
                    setProjectName(project.nombre);
                }
                // Fetch custom project settings
                if (project.idProyecto) {
                    fetchProjectSettings(project.idProyecto);
                }
            } catch (e) {
                console.error('Error parsing project data', e);
            }
        }

        // Listen for logo updates
        const handleLogoUpdate = (event: CustomEvent) => {
            if (event.detail) {
                setProjectLogo(event.detail);
            }
        };

        window.addEventListener('project-logo-updated', handleLogoUpdate as EventListener);

        return () => {
            window.removeEventListener('project-logo-updated', handleLogoUpdate as EventListener);
        };
    }, []);

    const fetchProjectSettings = async (projectId: number) => {
        try {
            const response = await fetch(`/api/project-header?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setProjectTitle(data.titulo || '');
                setProjectLogo(data.logo64 || '');
            }
        } catch (error) {
            console.error('Error fetching project settings:', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        if (onLogout) {
            onLogout();
        } else {
            router.push('/');
        }
    };

    // Determine what to display
    const displayTitle = projectTitle || `Foodie Guru${projectName ? ` - ${projectName}` : ''}`;

    return (
        <header
            className="fixed top-0 left-0 right-0 h-16 z-50 px-6 flex items-center justify-between shadow-lg"
            style={{
                background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`
            }}
        >
            <div className="flex items-center gap-4">
                <button
                    onClick={onToggleSidebar}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: colors.colorLetra }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    aria-label="Toggle Sidebar"
                >
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current stroke-2">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                {projectLogo && (
                    <img
                        src={projectLogo}
                        alt="Project Logo"
                        className="h-10 w-auto object-contain"
                        onError={() => setProjectLogo('')}
                    />
                )}
                <span
                    className="text-xl font-bold tracking-wide"
                    style={{ color: colors.colorLetra }}
                >
                    {displayTitle}
                </span>
            </div>

            <div className="flex items-center gap-4">
                <span
                    className="font-medium"
                    style={{ color: colors.colorLetra }}
                >
                    {userName || 'User'}
                </span>
                <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm font-medium rounded-full transition-all"
                    style={{
                        color: `${colors.colorLetra}e6`,
                        backgroundColor: 'rgba(255,255,255,0.1)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = colors.colorLetra;
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = `${colors.colorLetra}e6`;
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    }}
                >
                    {t('logout')}
                </button>
            </div>
        </header>
    );
}
