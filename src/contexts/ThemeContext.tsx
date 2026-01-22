'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ThemeColors {
    colorFondo1: string;
    colorFondo2: string;
    colorLetra: string;
}

interface ThemeContextType {
    colors: ThemeColors;
    setColors: (colors: ThemeColors) => void;
}

const defaultColors: ThemeColors = {
    colorFondo1: '#FF6B35', // Orange
    colorFondo2: '#F7931E', // Pink/Orange
    colorLetra: '#FFFFFF'   // White
};

const ThemeContext = createContext<ThemeContextType>({
    colors: defaultColors,
    setColors: () => { }
});

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [colors, setColors] = useState<ThemeColors>(defaultColors);

    useEffect(() => {
        // Fetch project colors
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            try {
                const project = JSON.parse(storedProject);
                if (project.idProyecto) {
                    fetchProjectColors(project.idProyecto);
                }
            } catch (e) {
                console.error('Error parsing project data', e);
            }
        }
    }, []);

    const fetchProjectColors = async (projectId: number) => {
        try {
            const response = await fetch(`/api/project-colors?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setColors({
                    colorFondo1: data.colorFondo1 || defaultColors.colorFondo1,
                    colorFondo2: data.colorFondo2 || defaultColors.colorFondo2,
                    colorLetra: data.colorLetra || defaultColors.colorLetra
                });
            }
        } catch (error) {
            console.error('Error fetching project colors:', error);
        }
    };

    return (
        <ThemeContext.Provider value={{ colors, setColors }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
