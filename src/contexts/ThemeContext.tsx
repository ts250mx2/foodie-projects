'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface ThemeColors {
    colorFondo1: string;
    colorFondo2: string;
    colorLetra: string;
}

interface ThemeContextType {
    colors: ThemeColors;
    setColors: (colors: ThemeColors) => void;
}

/**
 * Identidad de marca Foodie Gurú (del PDF de propuesta de marca).
 * Se removió la configuración de color primario por proyecto: ahora se usa
 * SIEMPRE la paleta de marca para sidebar, headers y modales.
 */
const defaultColors: ThemeColors = {
    colorFondo1: '#3b3be8', // Azul royal de marca (color primario)
    colorFondo2: '#0a0a0a', // Negro de marca (secundario)
    colorLetra: '#FFFFFF'   // Blanco
};

const ThemeContext = createContext<ThemeContextType>({
    colors: defaultColors,
    setColors: () => { }
});

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [colors, setColors] = useState<ThemeColors>(defaultColors);

    // Nota: la carga de colores por proyecto (fetchProjectColors) fue removida
    // a propósito para aplicar la identidad de marca de forma consistente.

    return (
        <ThemeContext.Provider value={{ colors, setColors }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
