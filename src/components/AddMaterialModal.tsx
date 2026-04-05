'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';

export interface SearchProduct {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    Categoria?: string;
    IdCategoria?: number;
    Presentacion?: string;
    Precio: number;
    CategoriaRecetario?: string; // Added from API
    IdCategoriaRecetario?: number;
    PesoInicial?: number;
    PesoFinal?: number;
    ConversionSimple?: number;
    IdPresentacionConversion?: number;
    PresentacionConversion?: string;
    Costo: number;
    ArchivoImagen?: string;
    NombreArchivo?: string;
    ImagenCategoria?: string;
    UnidadMedidaRecetario?: string;
    UnidadMedidaCompra?: string;
    UnidadMedidaInventario?: string;
}

interface Category {
    IdCategoriaRecetario: number;
    CategoriaRecetario: string;
}

interface AddMaterialModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (product: SearchProduct) => void;
    onNewMaterial: () => void; // Callback for "Nueva Materia Prima"
    projectId: number;
    productType: number; // 0 = Raw Material, 1 = Dish, 2 = Sub-recipe
    onEdit?: (product: SearchProduct) => void;
    refreshKey?: number;
    externalSearchTerm?: string;
}

export default function AddMaterialModal({
    isOpen,
    onClose,
    onSelect,
    onNewMaterial,
    projectId,
    productType,
    onEdit,
    refreshKey,
    externalSearchTerm
}: AddMaterialModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState<SearchProduct[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeTab, setActiveTab] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { colors } = useTheme();

    // Refresh data when opened or refreshKey changes
    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, refreshKey, productType]);

    // Update search term from parent
    useEffect(() => {
        if (externalSearchTerm) {
            setSearchTerm(externalSearchTerm);
        }
    }, [externalSearchTerm]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const typesToFetch = '0,2';
            const response = await fetch(`/api/products?projectId=${projectId}&tipoProducto=${typesToFetch}`);
            if (response.ok) {
                const data = await response.json();
                setProducts(data.data); // Assuming data structure is { success: true, data: [...] }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = searchTerm === '' ||
            p.Producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.Codigo.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesSearch;
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header - Themed Style */}
                <div 
                    className="px-6 py-4 flex justify-between items-center shadow-md"
                    style={{ backgroundColor: colors.colorFondo1, color: colors.colorLetra }}
                >
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        {productType === 0 ? '🥕 Agregar Materia Prima' : '🍽️ Agregar Insumo/Producto'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="hover:bg-white/20 rounded-full p-2 transition-colors text-white"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-4 border-b flex flex-col gap-4 bg-gray-50">
                    <input
                        type="text"
                        placeholder="🔍 Buscar por código o producto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:border-transparent outline-none transition-all"
                        style={{ focusRingColor: colors.colorFondo1 } as any}
                        autoFocus
                    />

                    {/* Tabs removed as per request */}

                    {/* New Material Button for all product types */}
                    <Button
                        onClick={onNewMaterial}
                        className="bg-green-600 hover:bg-green-700 text-white py-2 shadow-md w-full sm:w-auto self-end"
                    >
                        Nueva Materia Prima
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-white">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Cargando productos...</div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Foto</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Código</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Producto</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Categoría</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Costo</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Unidad Receta</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredProducts.map(p => {
                                    // Calculate Processed Price if needed
                                    // Calculation removed as cell is removed

                                    return (
                                        <tr key={p.IdProducto} className="hover:bg-primary-50 transition-colors border-b">
                                            <td className="px-4 py-3">
                                                {p.ArchivoImagen ? (
                                                    <img 
                                                        src={p.ArchivoImagen} 
                                                        alt={p.Producto} 
                                                        className="w-10 h-10 object-cover rounded shadow-sm border"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                                                        📷
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-gray-900">{p.Codigo}</td>
                                            <td className="px-4 py-3 text-sm text-gray-800 font-medium">{p.Producto}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-base">{p.ImagenCategoria || '📁'}</span>
                                                    <span>{p.Categoria || '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-black text-blue-700">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.Costo || p.Precio || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500 font-medium">
                                                {p.UnidadMedidaRecetario || '-'}
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <Button
                                                        onClick={() => {
                                                            onSelect(p);
                                                            setSearchTerm('');
                                                        }}
                                                        className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-3 py-1.5 text-xs shadow-sm"
                                                    >
                                                        ➕ Agregar
                                                    </Button>
                                                    {onEdit && (
                                                        <Button
                                                            onClick={() => onEdit(p)}
                                                            className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 active:bg-gray-800 shadow-sm"
                                                        >
                                                            ✏️ Editar
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {filteredProducts.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-gray-500 flex flex-col items-center gap-2">
                                            <span className="text-3xl">🔍</span>
                                            <span>No se encontraron productos</span>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div >
    );
}
