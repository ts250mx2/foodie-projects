'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import AddMaterialModal from '@/components/AddMaterialModal';
import { SearchProduct } from '@/components/ProductSearchModal';
import CostingModal from '@/components/CostingModal';
import Button from '@/components/Button';

interface RawMaterial {
    IdProducto: number;
    Codigo: string;
    Producto: string;
    Categoria: string;
    IdCategoriaRecetario: number;
    UnidadCompra: string;
    Precio: number;
    ConversionSimple: number;
    IdPresentacionConversion: number | null;
    UnidadConversion: string | null;
    PesoInicial: number;
    PesoFinal: number;
    ObservacionesMerma: string;
    IdProductoHijo?: number;
    Cantidad?: number;
    IdPresentacion?: number;
    IVA: number;
    RutaFoto?: string;
}

interface Presentation {
    IdPresentacion: number;
    Presentacion: string;
}

interface RecipeCategory {
    IdCategoriaRecetario: number;
    CategoriaRecetario: string;
}

export default function RawMaterialsPage() {
    const t = useTranslations('RawMaterials');

    const [materials, setMaterials] = useState<RawMaterial[]>([]);
    const [recipeCategories, setRecipeCategories] = useState<RecipeCategory[]>([]);
    const [presentations, setPresentations] = useState<Presentation[]>([]);
    const [editedFields, setEditedFields] = useState<Record<number, Partial<RawMaterial>>>({});
    const [project, setProject] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<number | null>(null);

    // Search Modal State
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [allProducts, setAllProducts] = useState<SearchProduct[]>([]);

    // Costing Modal State
    const [isCostingModalOpen, setIsCostingModalOpen] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchInitialData();
        }
    }, [project]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                fetchMaterials(),
                fetchRecipeCategories(),
                fetchPresentations(),
                fetchAllProducts()
            ]);
        } catch (error) {
            console.error('Error fetching initial data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMaterials = async () => {
        try {
            const response = await fetch(`/api/production/raw-materials?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setMaterials(data.data);
            }
        } catch (error) {
            console.error('Error fetching raw materials:', error);
        }
    };

    const fetchRecipeCategories = async () => {
        try {
            const response = await fetch(`/api/production/recipe-categories?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setRecipeCategories(data.data);
                if (data.data.length > 0 && activeTab === null) {
                    setActiveTab(data.data[0].IdCategoriaRecetario);
                }
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchPresentations = async () => {
        try {
            const response = await fetch(`/api/presentations?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setPresentations(data.data);
            }
        } catch (error) {
            console.error('Error fetching presentations:', error);
        }
    };

    const fetchAllProducts = async () => {
        try {
            const response = await fetch(`/api/products?projectId=${project.idProyecto}&tipoProducto=0`);
            const data = await response.json();
            if (data.success) {
                setAllProducts(data.data);
            }
        } catch (error) {
            console.error('Error fetching all products:', error);
        }
    };

    // Auto-assign conversion unit
    useEffect(() => {
        if (materials.length > 0 && presentations.length > 0) {
            const autoAssignments: Record<number, Partial<RawMaterial>> = {};

            materials.forEach(material => {
                if (!material.IdPresentacionConversion && material.UnidadCompra) {
                    const matchingPresentation = presentations.find(
                        p => p.Presentacion === material.UnidadCompra
                    );

                    if (matchingPresentation) {
                        autoAssignments[material.IdProducto] = {
                            IdPresentacionConversion: matchingPresentation.IdPresentacion
                        };
                        material.IdPresentacionConversion = matchingPresentation.IdPresentacion;
                        material.UnidadConversion = matchingPresentation.Presentacion;
                    }
                }
            });

            if (Object.keys(autoAssignments).length > 0) {
                setEditedFields(prev => {
                    const updated = { ...prev };
                    Object.entries(autoAssignments).forEach(([idProducto, fields]) => {
                        updated[parseInt(idProducto)] = {
                            ...updated[parseInt(idProducto)],
                            ...fields
                        };
                    });
                    return updated;
                });
            }
        }
    }, [materials.length, presentations.length]);


    const handleFieldChange = (idProducto: number, field: keyof RawMaterial, value: any) => {
        setEditedFields(prev => ({
            ...prev,
            [idProducto]: {
                ...prev[idProducto],
                [field]: value
            }
        }));

        setMaterials(prev => prev.map(material =>
            material.IdProducto === idProducto
                ? { ...material, [field]: value }
                : material
        ));
    };

    const handleSaveAll = async () => {
        if (Object.keys(editedFields).length === 0) {
            alert('No hay cambios para guardar');
            return;
        }

        setIsSaving(true);
        try {
            const updates = Object.entries(editedFields).map(([idProducto, fields]) => ({
                idProducto: parseInt(idProducto),
                precio: fields.Precio,
                conversionSimple: fields.ConversionSimple,
                idPresentacionConversion: fields.IdPresentacionConversion,
                pesoInicial: fields.PesoInicial,
                pesoFinal: fields.PesoFinal,
                observacionesMerma: fields.ObservacionesMerma
            }));

            const response = await fetch('/api/production/raw-materials', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    updates
                })
            });

            if (response.ok) {
                setEditedFields({});
                await fetchMaterials();
                alert('Cambios guardados exitosamente');
            } else {
                alert('Error al guardar los cambios');
            }
        } catch (error) {
            console.error('Error saving changes:', error);
            alert('Error al guardar los cambios');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddProduct = async (product: SearchProduct) => {
        if (!activeTab) return;

        try {
            const response = await fetch('/api/products/update-category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    productId: product.IdProducto,
                    categoryId: activeTab
                })
            });

            if (response.ok) {
                setIsSearchModalOpen(false);
                fetchMaterials(); // Refresh list to show new product
                alert('Producto agregado y asignado a la categoría exitosamente');
            } else {
                alert('Error al agregar el producto');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            alert('Error al agregar el producto');
        }
    };

    const handleRemoveProduct = async (product: RawMaterial) => {
        if (!confirm('¿Está seguro de quitar este producto de la categoría?')) return;

        try {
            const response = await fetch('/api/products/update-category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    productId: product.IdProducto,
                    categoryId: 0 // Unassign
                })
            });

            if (response.ok) {
                fetchMaterials();
                alert('Producto removido de la categoría exitosamente');
            } else {
                alert('Error al remover el producto');
            }
        } catch (error) {
            console.error('Error removing product:', error);
            alert('Error al remover el producto');
        }
    };

    const [newMaterialSearch, setNewMaterialSearch] = useState('');

    const handleNewMaterial = () => {
        // Keep search open
        setSelectedMaterial(null);
        setIsCostingModalOpen(true);
    };

    const handleEditProduct = (material: RawMaterial) => {
        setSelectedMaterial(material);
        setIsCostingModalOpen(true);
    };

    // Calculations
    const calculateYield = (pesoInicial: number, pesoFinal: number) => {
        if (!pesoInicial || pesoInicial === 0) return 0;
        return (pesoFinal / pesoInicial) * 100;
    };

    const calculateWaste = (pesoInicial: number, pesoFinal: number) => {
        if (!pesoInicial || pesoInicial === 0) return 0;
        return ((pesoInicial - pesoFinal) / pesoInicial) * 100;
    };

    const calculateNetPrice = (precio: number, pesoInicial: number, pesoFinal: number) => {
        if (!pesoInicial || pesoInicial === 0) return precio;
        return precio * (pesoFinal / pesoInicial);
    };

    const getValue = (material: RawMaterial, field: keyof RawMaterial) => {
        return editedFields[material.IdProducto]?.[field] ?? material[field];
    };

    if (isLoading) {
        return (
            <div className="p-6">
                <div className="text-center text-gray-600">Cargando materias primas...</div>
            </div>
        );
    }

    // Filter materials for active tab
    const activeMaterials = materials.filter(m => {
        if (m.IdCategoriaRecetario !== activeTab) return false;
        if (searchTerm === '') return true;
        return m.Producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.Codigo.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleEditFromSearch = (product: SearchProduct) => {
        const materialToEdit: any = {
            ...product,
        };

        setSelectedMaterial(materialToEdit);
        setIsCostingModalOpen(true);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    🥕 Materia Prima
                </h1>
                <div className="flex gap-2">
                    <Button onClick={() => setIsSearchModalOpen(true)}>
                        ➕ Agregar
                    </Button>
                    <Button
                        onClick={handleSaveAll}
                        disabled={isSaving || Object.keys(editedFields).length === 0}
                    >
                        {isSaving ? 'Guardando...' : `Guardar Todo ${Object.keys(editedFields).length > 0 ? `(${Object.keys(editedFields).length})` : ''}`}
                    </Button>
                </div>
            </div>

            {/* Search Filter */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="🔍 Buscar en esta categoría..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
            </div>

            {/* Tabs */}
            <div className="bg-gradient-to-r from-[--color-fondo-1] to-[--color-fondo-2] p-4 rounded-t-lg shadow-lg mb-0">
                <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/20">
                    {recipeCategories.map(category => (
                        <button
                            key={category.IdCategoriaRecetario}
                            onClick={() => setActiveTab(category.IdCategoriaRecetario)}
                            className={`px-4 py-2 rounded-t-lg text-sm transition-colors whitespace-nowrap ${activeTab === category.IdCategoriaRecetario
                                ? 'bg-white text-orange-600 font-bold'
                                : 'bg-orange-600/50 text-white hover:bg-orange-600/70 font-medium'
                                }`}
                        >
                            {category.CategoriaRecetario}
                        </button>
                    ))}
                    {recipeCategories.length === 0 && (
                        <div className="text-white/80 italic px-4 py-2">No hay categorías de recetario activas.</div>
                    )}
                </div>
            </div>

            {/* Active Tab Content */}
            {activeTab && (
                <div className="bg-white rounded-b-lg shadow overflow-hidden rounded-t-none">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-600">Código</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-600">Materia Prima</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-600">Unidad de Compra</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">P/U Compra</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-gray-600">Conv. Simple</th>
                                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-600">Unidad de Inventario</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">Peso Inicial</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">Peso Final</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">% Rendimiento</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">% Merma</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">P/U Neto</th>
                                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">Precio Procesado</th>
                                    <th className="px-3 py-2 text-center text-xs font-bold text-gray-600">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {activeMaterials.map((material) => {
                                    const precio = getValue(material, 'Precio') as number;
                                    const pesoInicial = getValue(material, 'PesoInicial') as number;
                                    const pesoFinal = getValue(material, 'PesoFinal') as number;
                                    const rendimiento = calculateYield(pesoInicial, pesoFinal);
                                    const merma = calculateWaste(pesoInicial, pesoFinal);
                                    const precioNeto = calculateNetPrice(precio, pesoInicial, pesoFinal);
                                    const conversionSimple = getValue(material, 'ConversionSimple') as number || 0;
                                    const precioProcesado = conversionSimple > 0 ? precioNeto / conversionSimple : 0;

                                    return (
                                        <tr key={material.IdProducto} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 text-sm text-gray-900">{material.Codigo}</td>
                                            <td className="px-3 py-2 text-sm text-gray-900">{material.Producto}</td>
                                            <td className="px-3 py-2 text-sm text-gray-600">{material.UnidadCompra}</td>
                                            <td className="px-3 py-2 text-right">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={precio || 0}
                                                    onChange={(e) => handleFieldChange(material.IdProducto, 'Precio', parseFloat(e.target.value) || 0)}
                                                    className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-2 focus:ring-orange-500"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={getValue(material, 'ConversionSimple') as number || 0}
                                                    onChange={(e) => handleFieldChange(material.IdProducto, 'ConversionSimple', parseFloat(e.target.value) || 0)}
                                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-orange-500"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={getValue(material, 'IdPresentacionConversion') as number || ''}
                                                    onChange={(e) => handleFieldChange(material.IdProducto, 'IdPresentacionConversion', parseInt(e.target.value) || null)}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {presentations.map(p => (
                                                        <option key={p.IdPresentacion} value={p.IdPresentacion}>
                                                            {p.Presentacion}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={pesoInicial || 0}
                                                    onChange={(e) => handleFieldChange(material.IdProducto, 'PesoInicial', parseFloat(e.target.value) || 0)}
                                                    className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-2 focus:ring-orange-500"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={pesoFinal || 0}
                                                    onChange={(e) => handleFieldChange(material.IdProducto, 'PesoFinal', parseFloat(e.target.value) || 0)}
                                                    className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-2 focus:ring-orange-500"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm font-medium text-green-600">
                                                {rendimiento.toFixed(2)}%
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm font-medium text-red-600">
                                                {merma.toFixed(2)}%
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm font-medium text-blue-600">
                                                ${precioNeto.toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm font-medium text-orange-600">
                                                ${precioProcesado.toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => handleEditProduct(material)}
                                                        className="text-gray-600 hover:text-blue-600 hover:scale-110 transition-transform"
                                                        title="Editar Materia Prima"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveProduct(material)}
                                                        className="text-gray-600 hover:text-red-600 hover:scale-110 transition-transform"
                                                        title="Quitar de esta categoría"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {activeMaterials.length === 0 && (
                                    <tr>
                                        <td colSpan={12} className="px-3 py-8 text-center text-gray-500">
                                            No hay materias primas en esta categoría.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {project && (
                <AddMaterialModal
                    isOpen={isSearchModalOpen}
                    onClose={() => setIsSearchModalOpen(false)}
                    onSelect={handleAddProduct}
                    onNewMaterial={handleNewMaterial}
                    projectId={project.idProyecto}
                    productType={0}
                    externalSearchTerm={newMaterialSearch}
                    onEdit={handleEditFromSearch}
                    refreshKey={refreshTrigger}
                />
            )}

            {isCostingModalOpen && project && (
                <CostingModal
                    isOpen={isCostingModalOpen}
                    onClose={() => {
                        setIsCostingModalOpen(false);
                        setSelectedMaterial(null);
                    }}
                    product={selectedMaterial as any}
                    projectId={project.idProyecto}
                    productType={0} // Materia Prima
                    onProductUpdate={(product, shouldClose = true) => {
                        fetchMaterials();
                        setRefreshTrigger(prev => prev + 1); // Refresh search modal
                        if (product) {
                            // Update search with Code as requested
                            setNewMaterialSearch(product.Codigo);
                            if (!shouldClose) {
                                setSelectedMaterial(product as any);
                            }
                        }
                        // Close modal if requested (default true for Costing Save)
                        if (shouldClose) {
                            setIsCostingModalOpen(false);
                            setSelectedMaterial(null);
                        }
                    }}
                    initialTab="general"
                />
            )}
        </div>
    );
}
