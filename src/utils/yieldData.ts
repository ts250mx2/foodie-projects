export interface YieldReference {
    name: string;
    yield: number;
    category: 'Proteina' | 'Vegetal';
}

export const YIELD_DATA: YieldReference[] = [
    // PROTEINS
    { name: 'Res (Bistec/Corte)', yield: 75, category: 'Proteina' },
    { name: 'Res (Molida)', yield: 70, category: 'Proteina' },
    { name: 'Cerdo (Pierna/Lomo)', yield: 80, category: 'Proteina' },
    { name: 'Pollo (Pechuga)', yield: 70, category: 'Proteina' },
    { name: 'Pollo (Entero)', yield: 65, category: 'Proteina' },
    { name: 'Pescado (Filete)', yield: 85, category: 'Proteina' },
    { name: 'Pescado (Entero)', yield: 50, category: 'Proteina' },
    { name: 'Camaron (Sin Cabeza)', yield: 80, category: 'Proteina' },
    { name: 'Camaron (Limpio)', yield: 65, category: 'Proteina' },

    // VEGETABLES
    { name: 'Cebolla (Limpia)', yield: 90, category: 'Vegetal' },
    { name: 'Jitomate/Tomate', yield: 95, category: 'Vegetal' },
    { name: 'Lechuga (Limpia)', yield: 80, category: 'Vegetal' },
    { name: 'Papa (Pelada)', yield: 85, category: 'Vegetal' },
    { name: 'Pimiento', yield: 80, category: 'Vegetal' },
    { name: 'Zanahoria (Pelada)', yield: 85, category: 'Vegetal' },
    { name: 'Aguacate (Sin Hueso)', yield: 70, category: 'Vegetal' },
    { name: 'Limon (Solo Jugo)', yield: 35, category: 'Vegetal' },
    { name: 'Ajo (Pelado)', yield: 90, category: 'Vegetal' },
    { name: 'Pepino (Limpio)', yield: 75, category: 'Vegetal' }
];
