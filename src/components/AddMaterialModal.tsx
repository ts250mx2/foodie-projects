'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/Button';

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
    // Add other fields if necessary
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
            // Always fetch raw materials (type 0) for now, as per simplified logic
            // Or if productType is passed, use it?
            // The previous logic (Step 1705) hardcoded tipoProducto=0 in some places?
            // Let's stick to existing fetchData logic but ensure dependency on refreshKey works.
            const typesToFetch = productType === 1 ? '0,2' : '0';
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
                {/* Header - CostingModal Style (Orange) */}
                <div className="bg-orange-500 text-white px-6 py-4 flex justify-between items-center shadow-md">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        {productType === 0 ? '🥕 Agregar Materia Prima' : '🍽️ Agregar Producto'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
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
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Código</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Producto</th>
                                    {productType > 0 ? (
                                        <>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Mód. Recetario</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Pres. Conversión</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Categoría</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Presentación</th>
                                        </>
                                    )}
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredProducts.map(p => {
                                    // Calculate Processed Price if needed
                                    // Calculation removed as cell is removed

                                    return (
                                        <tr key={p.IdProducto} className="hover:bg-orange-50 transition-colors">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.Codigo}</td>
                                            <td className="px-4 py-3 text-sm text-gray-800">{p.Producto}</td>

                                            {productType > 0 ? (
                                                <>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{p.CategoriaRecetario || '-'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{p.PresentacionConversion || '-'}</td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{p.Categoria || '-'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{p.Presentacion || '-'}</td>
                                                </>
                                            )}

                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <Button
                                                        onClick={() => {
                                                            onSelect(p);
                                                            setSearchTerm('');
                                                        }}
                                                        disabled={productType > 0 && (!p.IdCategoriaRecetario || p.IdCategoriaRecetario <= 0)}
                                                        className={`px-3 py-1.5 text-xs shadow-sm ${productType > 0 && (!p.IdCategoriaRecetario || p.IdCategoriaRecetario <= 0)
                                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                                                            }`}
                                                        title={productType > 0 && (!p.IdCategoriaRecetario || p.IdCategoriaRecetario <= 0) ? 'Debe asignar un Módulo de Recetario antes de agregar' : 'Agregar al Kit'}
                                                    >
                                                        ➕ Agregar
                                                    </Button>
                                                    {(onEdit || productType > 0) && (
                                                        <Button
                                                            onClick={() => onEdit && onEdit(p)}
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
