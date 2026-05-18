'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import LoadingSpinner from '@/components/LoadingSpinner';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { Carrot, UtensilsCrossed, X, Image, Folder, Plus, Pencil, Search } from 'lucide-react';

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
            (p.Producto || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.Codigo || '').toLowerCase().includes(searchTerm.toLowerCase());

        return matchesSearch;
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header - Themed Style */}
                <div
                    className="px-6 py-4 flex justify-between items-center sticky top-0 z-10"
                    style={{ backgroundColor: colors.colorFondo1, backgroundImage: 'none', color: colors.colorLetra }}
                >
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        {productType === 0 ? <Carrot size={20} /> : <UtensilsCrossed size={20} />}
                        {productType === 0 ? 'Agregar Materia Prima' : 'Agregar Insumo/Producto'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white"
                        title="Cerrar"
                    >
                        <X size={20} strokeWidth={2} />
                    </button>
                </div>

                <div className="p-4 border-b flex flex-col gap-3 bg-gray-50">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por código o producto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                                autoFocus
                            />
                        </div>
                        <Button
                            onClick={onNewMaterial}
                            className="bg-green-600 hover:bg-green-700 text-white shadow-sm whitespace-nowrap"
                            size="sm"
                            leftIcon={Plus}
                        >
                            Nueva Materia Prima
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-white">
                    {isLoading ? (
                        <div className="p-6">
                            <LoadingSpinner message="Cargando productos..." size="md" />
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200 border-collapse">
                            <ThemedGridHeader>
                                <ThemedGridHeaderCell>Foto</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>Código</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>Producto</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>Categoría</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="right">Costo</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>Unidad Receta</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="center">Acciones</ThemedGridHeaderCell>
                            </ThemedGridHeader>
                            <TableBody empty={filteredProducts.length === 0} emptyMessage="No se encontraron productos" colSpan={7}>
                                {filteredProducts.map(p => (
                                    <TableRow key={p.IdProducto}>
                                        <TableCell>
                                            {p.ArchivoImagen ? (
                                                <img
                                                    src={p.ArchivoImagen}
                                                    alt={p.Producto}
                                                    className="w-10 h-10 object-cover rounded shadow-sm border border-gray-200"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                                                    <Image size={18} />
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-bold text-gray-900">{p.Codigo}</TableCell>
                                        <TableCell className="font-medium text-gray-800">{p.Producto}</TableCell>
                                        <TableCell muted>
                                            <div className="flex items-center gap-1.5">
                                                <Folder size={16} className="text-gray-400" />
                                                <span>{p.Categoria || '-'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell align="right" className="font-bold text-blue-600">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.Costo || p.Precio || 0)}
                                        </TableCell>
                                        <TableCell muted>{p.UnidadMedidaRecetario || '-'}</TableCell>
                                        <TableCell align="center">
                                            <div className="flex items-center justify-center gap-1">
                                                <RowActionButton
                                                    icon={Plus}
                                                    label="Agregar"
                                                    variant="default"
                                                    onClick={() => {
                                                        onSelect(p);
                                                        setSearchTerm('');
                                                    }}
                                                />
                                                {onEdit && (
                                                    <RowActionButton
                                                        icon={Pencil}
                                                        label="Editar"
                                                        variant="edit"
                                                        onClick={() => onEdit(p)}
                                                    />
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </table>
                    )}
                </div>
            </div>
        </div >
    );
}
