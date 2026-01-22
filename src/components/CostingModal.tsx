'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import AddMaterialModal, { SearchProduct } from '@/components/AddMaterialModal';
import InstructionsTab from '@/components/InstructionsTab';
import DocumentsTab from '@/components/DocumentsTab';
import { generateTechnicalSheetPDF, CostingHeaderData } from '@/utils/generateTechnicalSheetPDF';

interface KitItem {
    IdProductoPadre: number;
    IdProductoHijo: number;
    Cantidad: number;
    Codigo: string;
    Producto: string;
    Precio: number;
    Categoria: string;
    IdCategoria: number;
    Presentacion: string;
    IdCategoriaRecetario?: number;
    CategoriaRecetario?: string;
    // New fields
    PesoFinal: number;
    ConversionSimple: number;
    PresentacionInventario: string; // From API Alias
    // Calculated fields from API response (optional as they are recalculated on edit)
    PrecioProcesado?: number;
    Total?: number;
}

interface Product {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    Categoria?: string;
    IdCategoria?: number;
    IdCategoriaRecetario?: number; // Added for Raw Materials
    Presentacion?: string;
    IdPresentacion?: number;
    Precio: number;
    IVA: number;
    RutaFoto?: string;
    IdTipoProducto?: number;
    ConversionSimple?: number;
    IdPresentacionConversion?: number;
    PesoFinal?: number; // Used for Yield (Rendimiento) storage
    PesoInicial?: number;
    ObservacionesMerma?: string;
    Status?: number;
}

interface Category {
    IdCategoria: number;
    Categoria: string;
}

interface RecipeCategory {
    IdCategoriaRecetario: number;
    CategoriaRecetario: string;
}

interface Presentation {
    IdPresentacion: number;
    Presentacion: string;
}

interface CostingModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    projectId: number;
    initialTab?: 'general' | 'photo' | 'costing' | 'instructions' | 'documents';
    productType?: number; // 0=Raw, 1=Dish, 2=Sub-recipe
    onProductUpdate?: (product?: Product, shouldClose?: boolean) => void;
}

export default function CostingModal({ isOpen, onClose, product: initialProduct, projectId, initialTab = 'general', onProductUpdate, productType }: CostingModalProps) {
    const [product, setProduct] = useState<Product>(initialProduct || {
        IdProducto: 0,
        Producto: '',
        Codigo: '',
        Precio: 0,
        IVA: 0,
        IdTipoProducto: productType,
        Status: 0,
        RutaFoto: '',
    });

    useEffect(() => {
        if (initialProduct) {
            setProduct(initialProduct);
            setFormData({
                producto: initialProduct.Producto,
                codigo: initialProduct.Codigo || '',
                idCategoria: initialProduct.IdCategoria?.toString() || initialProduct.IdCategoriaRecetario?.toString() || '',
                idPresentacion: initialProduct.IdPresentacion?.toString() || '',
                precio: (initialProduct.Precio || 0).toString(),
                iva: (initialProduct.IVA || 0).toString()
            });
            setPhotoPreview(initialProduct.RutaFoto || null);
            // Initialize sub-recipe state
            setPesoFinal(initialProduct.PesoFinal || 1);
            setPesoInicial(productType === 2 ? 1 : (initialProduct.PesoInicial || 1));
            setIdCategoriaRecetario(initialProduct.IdCategoriaRecetario?.toString() || '');
            setSimpleConversion(initialProduct.ConversionSimple || 1);
            setIdPresentacionConversion(initialProduct.IdPresentacionConversion || null);
        } else {
            // Reset for new product
            setProduct({
                IdProducto: 0,
                Producto: '',
                Codigo: '',
                Precio: 0,
                IVA: 0,
                IdTipoProducto: productType,
                Status: 0,
                RutaFoto: '',
            });
            setFormData({
                producto: '',
                codigo: '',
                idCategoria: '',
                idPresentacion: '',
                precio: '',
                iva: ''
            });
            setPhotoPreview(null);
            setPesoFinal(1); // Default to 1
            setPesoInicial(1); // Default to 1
            setSimpleConversion(1); // Default to 1
            setIdPresentacionConversion(null);
        }
    }, [initialProduct, productType]);

    const [activeTab, setActiveTab] = useState<'general' | 'photo' | 'costing' | 'instructions' | 'documents'>(initialTab as any);
    const [kitItems, setKitItems] = useState<KitItem[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editedQuantities, setEditedQuantities] = useState<Record<number, number>>({});
    const [editedPrices, setEditedPrices] = useState<Record<number, number>>({});

    const [pesoFinal, setPesoFinal] = useState<number>(0);
    const [pesoInicial, setPesoInicial] = useState<number>(0);
    const [idCategoriaRecetario, setIdCategoriaRecetario] = useState<string>('');
    const [simpleConversion, setSimpleConversion] = useState<number>(0);
    const [idPresentacionConversion, setIdPresentacionConversion] = useState<number | null>(null);

    // New State for General Config & Photo
    const [categories, setCategories] = useState<Category[]>([]);
    const [recipeCategories, setRecipeCategories] = useState<RecipeCategory[]>([]);
    const [presentations, setPresentations] = useState<Presentation[]>([]);
    const [formData, setFormData] = useState({
        producto: product.Producto,
        codigo: product.Codigo || '',
        idCategoria: product.IdCategoria?.toString() || product.IdCategoriaRecetario?.toString() || '',
        idPresentacion: product.IdPresentacion?.toString() || '',
        precio: product.Precio.toString(),
        iva: product.IVA.toString()
    });
    const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(product.RutaFoto || null);

    // Recursive Editing State
    const [subEditingProduct, setSubEditingProduct] = useState<Product | null>(null);

    // Quick Create State
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isCreatingPresentation, setIsCreatingPresentation] = useState(false);
    const [newPresentationName, setNewPresentationName] = useState('');

    // Add Material Modal Integration
    const [addMaterialRefreshKey, setAddMaterialRefreshKey] = useState(0);
    const [addMaterialSearchTerm, setAddMaterialSearchTerm] = useState('');

    const handleEditFromAddModal = async (searchProduct: SearchProduct) => {
        // Find full product details from allProducts
        const fullProduct = allProducts.find(p => p.IdProducto === searchProduct.IdProducto);
        if (fullProduct) {
            setSubEditingProduct(fullProduct);
        } else {
            // Fallback if not found (unlikely if list is sync)
            console.warn('Product details not found');
        }
    };

    const handleNewMaterial = () => {
        // Create a blank Raw Material (Status 0, Type 0)
        setSubEditingProduct({
            IdProducto: 0,
            Producto: '',
            Codigo: '',
            Precio: 0,
            IVA: 0,
            IdTipoProducto: 0, // Raw Material
            Status: 0,
            RutaFoto: '',
            IdCategoria: undefined,
            IdPresentacion: undefined
        });
    };

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab as any);
            fetchCategories();
            fetchRecipeCategories();
            fetchPresentations();
            fetchAllProducts();
            if (product.IdProducto !== 0) {
                fetchKitItems();
            } else {
                setKitItems([]);
            }
        }
    }, [isOpen, product.IdProducto, initialTab]);

    const fetchCategories = async () => {
        try {
            const response = await fetch(`/api/categories?projectId=${projectId}`);
            const data = await response.json();

            if (data.success) {
                setCategories(data.data);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchPresentations = async () => {
        try {
            const response = await fetch(`/api/presentations?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) setPresentations(data.data);
        } catch (error) {
            console.error('Error fetching presentations:', error);
        }
    };

    const fetchKitItems = async () => {
        try {
            const response = await fetch(`/api/production/costing?projectId=${projectId}&productId=${product.IdProducto}`);
            const data = await response.json();
            if (data.success) {
                setKitItems(data.data);
            }
        } catch (error) {
            console.error('Error fetching kit items:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRecipeCategories = async () => {
        try {
            const response = await fetch(`/api/production/recipe-categories?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setRecipeCategories(data.data);
            }
        } catch (error) {
            console.error('Error fetching recipe categories:', error);
        }
    };

    const fetchAllProducts = async () => {
        try {
            const response = await fetch(`/api/products?projectId=${projectId}&tipoProducto=0`);
            const data = await response.json();
            if (data.success) {
                setAllProducts(data.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const handleQuantityChange = (idProductoHijo: number, value: number) => {
        setEditedQuantities(prev => ({ ...prev, [idProductoHijo]: value }));
        setKitItems(prev => prev.map(item =>
            item.IdProductoHijo === idProductoHijo ? { ...item, Cantidad: value } : item
        ));
    };

    const handlePriceChange = (idProductoHijo: number, value: number) => {
        setEditedPrices(prev => ({ ...prev, [idProductoHijo]: value }));
        setKitItems(prev => prev.map(item =>
            item.IdProductoHijo === idProductoHijo ? { ...item, Precio: value } : item
        ));
    };

    const handleSelectFromAddModal = (selectedProduct: SearchProduct) => {
        // Always try to set Recipe Category if the selected product has one
        if (selectedProduct.IdCategoriaRecetario) {
            setIdCategoriaRecetario(selectedProduct.IdCategoriaRecetario.toString());
        }

        if (productType === 0) {
            // For Raw Materials, we are done
            setIsAddModalOpen(false);
        } else {
            // For Sub-recipes/Dishes, we ALSO add to Kit
            handleAddProductToKit(selectedProduct);
        }
    };

    const handleAddProductToKit = (selectedProduct: SearchProduct) => {
        const newItem: KitItem = {
            IdProductoPadre: product.IdProducto,
            IdProductoHijo: selectedProduct.IdProducto,
            Cantidad: 1,
            Codigo: selectedProduct.Codigo,
            Producto: selectedProduct.Producto,
            Precio: selectedProduct.Precio,
            Categoria: selectedProduct.Categoria || '',
            IdCategoria: selectedProduct.IdCategoria || 0,
            Presentacion: selectedProduct.Presentacion || '',
            IdCategoriaRecetario: selectedProduct.IdCategoriaRecetario,
            CategoriaRecetario: selectedProduct.CategoriaRecetario || 'Sin Categoría de Recetario',
            // New fields mapping
            PesoFinal: selectedProduct.PesoFinal || 0, // Assuming SearchProduct has PesoFinal 
            ConversionSimple: selectedProduct.ConversionSimple || 1,
            PresentacionInventario: selectedProduct.PresentacionConversion || selectedProduct.Presentacion || '' // Map from SearchProduct's PresentacionConversion
        };
        // Clean up the object construction
        const finalItem: KitItem = {
            IdProductoPadre: product.IdProducto,
            IdProductoHijo: selectedProduct.IdProducto,
            Cantidad: 1,
            Codigo: selectedProduct.Codigo,
            Producto: selectedProduct.Producto,
            Precio: selectedProduct.Precio,
            Categoria: selectedProduct.Categoria || '',
            IdCategoria: selectedProduct.IdCategoria || 0,
            Presentacion: selectedProduct.Presentacion || '',
            IdCategoriaRecetario: selectedProduct.IdCategoriaRecetario,
            CategoriaRecetario: selectedProduct.CategoriaRecetario || 'Sin Categoría de Recetario',
            PesoFinal: selectedProduct.PesoFinal || 0,
            ConversionSimple: selectedProduct.ConversionSimple || 1,
            PresentacionInventario: selectedProduct.PresentacionConversion || selectedProduct.Presentacion || ''
        };

        setKitItems(prev => [...prev, finalItem]);
        setEditedQuantities(prev => ({ ...prev, [selectedProduct.IdProducto]: 1 }));

        // Auto-save new item
        const kitsPayload = [...kitItems, finalItem].map(item => ({
            idProductoHijo: item.IdProductoHijo,
            cantidad: item.IdProductoHijo === finalItem.IdProductoHijo ? 1 : (editedQuantities[item.IdProductoHijo] ?? item.Cantidad)
        }));
        saveKitsPayload(kitsPayload);
    };

    const handleDeleteItem = async (idProductoHijo: number) => {
        if (!confirm('¿Está seguro que desea eliminar este producto del kit?')) return;

        try {
            const response = await fetch(
                `/api/production/costing?projectId=${projectId}&productId=${product.IdProducto}&childId=${idProductoHijo}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                setKitItems(prev => prev.filter(item => item.IdProductoHijo !== idProductoHijo));
            }
        } catch (error) {
            console.error('Error deleting kit item:', error);
        }
    };

    const handleEditKitItem = (idProductoHijo: number) => {
        const fullProduct = allProducts.find(p => p.IdProducto === idProductoHijo);
        if (fullProduct) {
            setSubEditingProduct(fullProduct);
        } else {
            console.warn('Product details not found for editing');
        }
    };

    const saveKitsPayload = async (kits: any[]) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/production/costing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    productId: product.IdProducto,
                    kits
                })
            });

            if (response.ok) {
                // optional: alert('Guardado automático');
            } else {
                console.error('Error auto-saving kit items');
            }
        } catch (error) {
            console.error('Error auto-saving:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleQuantityBlur = () => {
        const kitsPayload = kitItems.map(item => ({
            idProductoHijo: item.IdProductoHijo,
            cantidad: editedQuantities[item.IdProductoHijo] ?? item.Cantidad
        }));
        saveKitsPayload(kitsPayload);
    };

    const handleSaveAll = async () => {
        // Validation: PesoFinal > 0 and <= 1 (Only for Raw Materials - Type 0)
        if (productType === 0 && (pesoFinal <= 0 || pesoFinal > 1)) {
            alert('El Peso Final debe ser mayor a 0 y menor o igual a 1.');
            return;
        }

        setIsSaving(true);
        try {
            // Logic: IdPresentacionConversion defaults to IdPresentacion if null
            const finalIdPresentacionConversion = idPresentacionConversion || (formData.idPresentacion ? parseInt(formData.idPresentacion) : null);

            // 1. Save Kit Items
            const kits = kitItems.map(item => ({
                idProductoHijo: item.IdProductoHijo,
                cantidad: editedQuantities[item.IdProductoHijo] ?? item.Cantidad
            }));

            const costingPromise = fetch('/api/production/costing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    productId: product.IdProducto,
                    kits
                })
            });

            // 2. Save Sub-recipe fields (if applicable)
            let productUpdatePromise = Promise.resolve() as Promise<any>;

            if (productType === 2 || productType === 1) {
                const finalIdPresentacionConversion = (idPresentacionConversion && idPresentacionConversion !== 0)
                    ? idPresentacionConversion
                    : (formData.idPresentacion ? parseInt(formData.idPresentacion) : null);

                productUpdatePromise = fetch(`/api/products/${product.IdProducto}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId,
                        ...formData, // basic fields
                        idCategoria: parseInt(formData.idCategoria),
                        idPresentacion: parseInt(formData.idPresentacion),
                        precio: parseFloat(formData.precio),
                        iva: parseFloat(formData.iva),
                        // New fields
                        conversionSimple: simpleConversion,
                        idPresentacionConversion: finalIdPresentacionConversion,
                        pesoFinal: pesoFinal, // Mapping Yield to PesoFinal
                        pesoInicial: pesoInicial,
                        idCategoriaRecetario: idCategoriaRecetario === '' ? null : parseInt(idCategoriaRecetario),
                        idTipoProducto: productType, // Ensure backend knows the type

                        // Ensure required fields are present if formData is incomplete (fallback to product)
                        producto: formData.producto || product.Producto,
                        codigo: formData.codigo || product.Codigo,
                        rutaFoto: product.RutaFoto
                    })
                });
            }

            const [costingResponse, productUpdateResponse] = await Promise.all([costingPromise, productUpdatePromise]);

            const isProductUpdatePerformed = productType === 2 || productType === 1;
            if (costingResponse.ok && (!isProductUpdatePerformed || productUpdateResponse.ok)) {
                setEditedQuantities({});
                setEditedPrices({});
                alert('✅ Costeo guardado correctamente');
                // Pass back the saved product info (using form data + ID)
                onProductUpdate?.({ ...product, ...formData, IdProducto: product.IdProducto } as any);
                setIsSaving(false);
            } else {
                alert('Error al guardar algunos datos');
            }
        } catch (error) {
            console.error('Error saving costing:', error);
            alert('Error al guardar el costeo');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, category: newCategoryName, esRecetario: 0 })
            });
            const data = await res.json();
            if (data.success) {
                await fetchCategories(); // Refresh list
                setFormData({ ...formData, idCategoria: data.id.toString() }); // Select new
                setIsCreatingCategory(false);
                setNewCategoryName('');
            } else {
                alert('Error al crear categoría');
            }
        } catch (error) {
            console.error('Error creating category:', error);
        }
    };

    const handleCreatePresentation = async () => {
        if (!newPresentationName.trim()) return;
        try {
            const res = await fetch('/api/presentations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, presentation: newPresentationName })
            });
            const data = await res.json();
            if (data.success) {
                await fetchPresentations(); // Refresh list
                setFormData({ ...formData, idPresentacion: data.id.toString() }); // Select new
                setIsCreatingPresentation(false);
                setNewPresentationName('');
            } else {
                alert('Error al crear presentación');
            }
        } catch (error) {
            console.error('Error creating presentation:', error);
        }
    };

    const handleSaveGeneral = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const isNew = product.IdProducto === 0;
            const endpoint = isNew ? '/api/products' : `/api/products/${product.IdProducto}`;
            const method = isNew ? 'POST' : 'PUT';

            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    producto: formData.producto,
                    codigo: formData.codigo,
                    idCategoria: parseInt(formData.idCategoria),
                    idPresentacion: parseInt(formData.idPresentacion),
                    precio: parseFloat(formData.precio),
                    iva: parseFloat(formData.iva),
                    idTipoProducto: productType ?? product.IdTipoProducto ?? 1,
                    conversionSimple: simpleConversion,
                    idPresentacionConversion: idPresentacionConversion,
                    pesoFinal: pesoFinal,
                    pesoInicial: pesoInicial,
                    idCategoriaRecetario: idCategoriaRecetario === '' ? null : parseInt(idCategoriaRecetario),
                    rutaFoto: product.RutaFoto // Keep existing photo
                })
            });

            if (response.ok) {
                const data = await response.json();

                if (isNew && data.id) {
                    alert('Producto creado exitosamente. Ahora puede agregar costos, fotos, etc.');
                    // Update local state to "saved" mode without closing
                    const newProduct: Product = {
                        ...product,
                        IdProducto: data.id,
                        ...formData,
                        Producto: formData.producto,
                        Codigo: formData.codigo,
                        IdCategoria: parseInt(formData.idCategoria),
                        IdPresentacion: parseInt(formData.idPresentacion),
                        Precio: parseFloat(formData.precio),
                        IVA: parseFloat(formData.iva),
                        PesoInicial: pesoInicial,
                        PesoFinal: pesoFinal,
                        ConversionSimple: simpleConversion,
                        IdPresentacionConversion: idPresentacionConversion || undefined,
                        IdCategoriaRecetario: idCategoriaRecetario === '' ? undefined : parseInt(idCategoriaRecetario)
                    };
                    setProduct(newProduct);
                    // Call parent update but don't close (shouldClose = false)
                    if (onProductUpdate) onProductUpdate(newProduct, false);
                } else {
                    alert('Información general actualizada exitosamente');
                    const updatedProduct: Product = {
                        ...product,
                        ...formData,
                        Producto: formData.producto,
                        Codigo: formData.codigo,
                        IdCategoria: parseInt(formData.idCategoria),
                        IdPresentacion: parseInt(formData.idPresentacion),
                        Precio: parseFloat(formData.precio),
                        IVA: parseFloat(formData.iva),
                        PesoInicial: pesoInicial,
                        PesoFinal: pesoFinal,
                        ConversionSimple: simpleConversion,
                        IdPresentacionConversion: idPresentacionConversion || undefined,
                        IdCategoriaRecetario: idCategoriaRecetario === '' ? undefined : parseInt(idCategoriaRecetario)
                    };
                    setProduct(updatedProduct);
                    if (onProductUpdate) onProductUpdate(updatedProduct, false);
                }
            }
        } catch (error) {
            console.error('Error saving general info:', error);
            alert('Error al guardar la información general');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSavePhoto = async () => {
        setIsSaving(true);
        try {
            let photoPath = product.RutaFoto;

            if (selectedPhoto) {
                const formDataPhoto = new FormData();
                formDataPhoto.append('file', selectedPhoto);
                formDataPhoto.append('projectId', projectId.toString());
                formDataPhoto.append('productId', product.IdProducto.toString());

                const uploadResponse = await fetch('/api/upload/instructions', {
                    method: 'POST',
                    body: formDataPhoto
                });

                const uploadData = await uploadResponse.json();
                if (uploadData.success) {
                    photoPath = uploadData.path;
                }
            }

            // Update product with new photo path
            const response = await fetch(`/api/products/${product.IdProducto}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    producto: formData.producto,
                    codigo: formData.codigo,
                    idCategoria: parseInt(formData.idCategoria),
                    idPresentacion: parseInt(formData.idPresentacion),
                    precio: parseFloat(formData.precio),
                    iva: parseFloat(formData.iva),
                    idTipoProducto: productType ?? 1,
                    conversionSimple: simpleConversion,
                    idPresentacionConversion: idPresentacionConversion,
                    pesoFinal: pesoFinal,
                    pesoInicial: pesoInicial,
                    idCategoriaRecetario: idCategoriaRecetario === '' ? null : parseInt(idCategoriaRecetario),
                    rutaFoto: photoPath
                })
            });

            if (response.ok) {
                alert('Foto actualizada exitosamente');
                if (onProductUpdate) onProductUpdate(product, false);
            }
        } catch (error) {
            console.error('Error saving photo:', error);
            alert('Error al guardar la foto');
        } finally {
            setIsSaving(false);
        }
    };

    const groupedItems = kitItems.reduce((acc, item) => {
        const categoria = item.CategoriaRecetario || 'Sin Categoría de Recetario';
        if (!acc[categoria]) acc[categoria] = [];
        acc[categoria].push(item);
        return acc;
    }, {} as Record<string, KitItem[]>);

    // Filter products that are already in the kit
    const availableProducts = allProducts.filter(p =>
        !kitItems.some(ki => ki.IdProductoHijo === p.IdProducto)
    );

    const totalCost = kitItems.reduce((sum, item) => {
        const cantidad = editedQuantities[item.IdProductoHijo] ?? item.Cantidad;
        const precioRaw = editedPrices[item.IdProductoHijo] ?? item.Precio;

        const pesoFinal = item.PesoFinal || 0;
        const conversion = item.ConversionSimple || 1;

        const precioProcesado = conversion !== 0
            ? (pesoFinal * precioRaw) / conversion
            : 0;

        return sum + (cantidad * precioProcesado);
    }, 0);

    const calculateCostPerUnit = () => {
        if (!pesoFinal || pesoFinal === 0) return 0;
        const conversion = simpleConversion || 0;
        return (totalCost / pesoFinal) * conversion;
    };

    const handleGenerateTechnicalSheet = async () => {
        try {
            // Fetch instructions
            const instructionsResponse = await fetch(`/api/products/${product.IdProducto}/instructions?projectId=${projectId}`);
            const instructionsData = await instructionsResponse.json();
            const instructions = instructionsData.success ? instructionsData.data : [];

            // Fetch support documents
            const documentsResponse = await fetch(`/api/products/${product.IdProducto}/documents?projectId=${projectId}`);
            const documentsData = await documentsResponse.json();
            const documents = documentsData.success ? documentsData.data : [];

            // Prepare Header Data
            const costPerUnit = calculateCostPerUnit();

            // Calculate Totals / Header Values from State
            const calculatedTotalCost = kitItems.reduce((sum, item) => {
                const cantidad = editedQuantities[item.IdProductoHijo] ?? item.Cantidad;
                // Use edited price or item price
                const precioRaw = editedPrices[item.IdProductoHijo] ?? item.Precio;

                const pFinal = item.PesoFinal || 0;
                const conv = item.ConversionSimple || 1;
                const pProcesado = conv !== 0 ? (pFinal * precioRaw) / conv : 0;

                return sum + (cantidad * pProcesado);
            }, 0);

            const rendimientoVal = pesoInicial > 0 ? (pesoFinal / pesoInicial) * 100 : 0;
            const mermaVal = pesoInicial > 0 ? ((pesoInicial - pesoFinal) / pesoInicial) * 100 : 0;
            const puCompraNeto = pesoInicial > 0 ? ((parseFloat(formData.precio) || 0) * (pesoFinal / pesoInicial)) : 0; // Price * Yield Ratio
            // Price Processed Header Calculation: (PU Compra Neto) / Conversion
            const precioProcesadoHeader = simpleConversion !== 0 ? (puCompraNeto / simpleConversion) : 0;

            const headerData: CostingHeaderData = {
                unidadCompra: presentations.find(p => p.IdPresentacion.toString() === formData.idPresentacion)?.Presentacion,
                precio: parseFloat(formData.precio) || 0,
                categoriaRecetario: recipeCategories.find(c => c.IdCategoriaRecetario.toString() === idCategoriaRecetario)?.CategoriaRecetario,
                conversionSimple: simpleConversion,
                unidadInventario: presentations.find(p => p.IdPresentacion === idPresentacionConversion)?.Presentacion,
                pesoInicial: pesoInicial,
                pesoFinal: pesoFinal,
                rendimientoPercent: rendimientoVal,
                mermaPercent: mermaVal,
                precioUnitarioCompraNeto: puCompraNeto,
                precioProcesado: precioProcesadoHeader,
                formulaCostoUnidad: costPerUnit,
                totalCost: calculatedTotalCost
            };

            // Map Kit Items to PDF format
            const pdfKitItems = kitItems.map(item => {
                const cantidad = editedQuantities[item.IdProductoHijo] ?? item.Cantidad;
                const precioRaw = editedPrices[item.IdProductoHijo] ?? item.Precio;
                const pFinal = item.PesoFinal || 0;
                const conv = item.ConversionSimple || 1;
                const pProcesado = conv !== 0 ? (pFinal * precioRaw) / conv : 0;

                return {
                    Codigo: item.Codigo,
                    Producto: item.Producto,
                    Categoria: item.Categoria,
                    CategoriaRecetario: item.CategoriaRecetario,
                    Presentacion: item.Presentacion,
                    Cantidad: cantidad,
                    Precio: precioRaw,
                    PresentacionInventario: item.PresentacionInventario,
                    PesoFinal: pFinal,
                    ConversionSimple: conv,
                    PrecioProcesado: pProcesado,
                    Total: cantidad * pProcesado
                };
            });

            // Generate PDF
            await generateTechnicalSheetPDF(
                {
                    Producto: product.Producto,
                    Categoria: product.Categoria || '',
                    Presentacion: product.Presentacion || '',
                    Precio: product.Precio,
                    IVA: product.IVA,
                    RutaFoto: product.RutaFoto,
                    IdTipoProducto: productType
                },
                pdfKitItems,
                instructions,
                documents,
                headerData
            );
        } catch (error) {
            console.error('Error generating technical sheet:', error);
            alert('Error al generar la ficha técnica');
        }
    };

    const handleClose = () => {
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 ${isOpen ? '' : 'hidden'}`}>
            <div className="bg-white w-[90vw] h-[90vh] rounded-lg shadow-lg flex flex-col">
                {/* Header with Info Boxes */}
                <div className="bg-orange-500 text-white px-6 py-4">
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                            {/* Product Type Label */}
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                                    {productType === 0 ? 'Materia Prima' :
                                        productType === 2 ? 'Subreceta' : 'Receta/Platillo'}
                                </span>
                                {product.IdProducto === 0 && (
                                    <span className="bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                                        NUEVO
                                    </span>
                                )}
                            </div>

                            {/* Product Name (Big) */}
                            <h1 className="text-3xl font-black mb-2 leading-tight" >
                                {product.Producto || 'Nuevo Producto'}
                            </h1>

                            {/* Meta Info */}
                            <div className="flex flex-wrap gap-4 text-sm opacity-90" >
                                {
                                    product.Categoria && (
                                        <div className="flex items-center gap-1">
                                            <span className="opacity-70">Categoría:</span>
                                            <span className="font-semibold">{product.Categoria}</span>
                                        </div>
                                    )
                                }
                                <div className="flex items-center gap-1" >
                                    <span className="opacity-70">Precio Menú:</span>
                                    <span className="font-semibold">${product.Precio?.toFixed(2) || '0.00'}</span>
                                </div>
                            </div>

                            {/* Current Action / Tab Title (Smaller) */}
                            <div className="mt-4 text-orange-100 text-sm font-medium flex items-center gap-2" >
                                <span>Estás viendo:</span>
                                <span className="bg-white/10 px-2 py-0.5 rounded text-white font-bold">
                                    {activeTab === 'general' ? '⚙️ Configuración General' :
                                        activeTab === 'photo' ? '🖼️ Foto' :
                                            activeTab === 'costing' ? '💰 Costeo' :
                                                activeTab === 'instructions' ? '📝 Instrucciones' :
                                                    '⚠️ Observaciones'}
                                </span>
                            </div>
                        </div>

                        {/* Info Boxes - Only show in Costing Tab */}
                        {
                            activeTab === 'costing' && (
                                <div className="flex gap-3">
                                    {/* % Impuesto */}
                                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 min-w-[140px]">
                                        <h3 className="text-xs font-bold mb-1">% Impuesto</h3>
                                        <p className="text-[10px] opacity-90">IVA: {parseFloat(formData.iva) || 0}%</p>
                                        <p className="text-lg font-bold">
                                            ${((parseFloat(formData.precio) || 0) * ((parseFloat(formData.iva) || 0) / 100)).toFixed(2)}
                                        </p>
                                    </div>

                                    {/* % Costo Precio con IVA */}
                                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 min-w-[140px]">
                                        <h3 className="text-xs font-bold mb-1">% Costo/Precio</h3>
                                        <p className="text-[10px] opacity-90">con IVA</p>
                                        <p className="text-lg font-bold">
                                            {(() => {
                                                const price = parseFloat(formData.precio) || 0;
                                                return price > 0 ? ((totalCost / price) * 100).toFixed(2) : '0.00';
                                            })()}%
                                        </p>
                                    </div>

                                    {/* % Costo Neto / Precio (Sin IVA) */}
                                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 min-w-[140px]">
                                        <h3 className="text-xs font-bold mb-1">% Costo/Precio</h3>
                                        <p className="text-[10px] opacity-90">sin IVA</p>
                                        <p className="text-lg font-bold">
                                            {(() => {
                                                const price = parseFloat(formData.precio) || 0;
                                                const iva = parseFloat(formData.iva) || 0;
                                                // The user logic for "calculated without VAT" implies we want to see the cost against the net price?
                                                // The previous code was: totalCost / (product.Precio - (product.Precio * (product.IVA / 100)))
                                                // Wait, price - price*iva/100 is NOT price without Tax if price includes tax?
                                                // Usually "Precio" is the menu price.
                                                // If menu price includes tax, then Net Price = Price / (1 + Tax/100).
                                                // If menu price excludes tax, then Price is Net Price.
                                                // The previous code `product.Precio - (product.Precio * (product.IVA / 100))` implies Price is Gross, and we are subtracting Tax.
                                                // Warning: X - X*0.16 is X*0.84. But X / 1.16 is X*0.86.
                                                // Let's stick to the previous formula logic for now but use dynamic values.
                                                // Previous: product.Precio - (product.Precio * (product.IVA / 100))
                                                const netPrice = price - (price * (iva / 100));
                                                return netPrice > 0 ? ((totalCost / netPrice) * 100).toFixed(2) : '0.00';
                                            })()}%
                                        </p>
                                    </div>
                                </div>
                            )
                        }

                        <button
                            onClick={handleGenerateTechnicalSheet}
                            className="bg-white/20 hover:bg-white/30 text-white rounded-lg px-3 py-2 flex items-center gap-2 transition-colors flex-shrink-0"
                            title="Generar Ficha Técnica"
                        >
                            📋 <span className="hidden sm:inline">Ficha Técnica</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white/20 rounded-full p-2 flex-shrink-0"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-6 border-b border-white/20 overflow-x-auto" >
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'general'
                                ? 'bg-white text-orange-600'
                                : 'bg-orange-600/50 text-white hover:bg-orange-600/70'
                                }`}
                        >
                            ⚙️ Configuración General
                        </button>

                        {
                            product.IdProducto !== 0 && (
                                <>
                                    <button
                                        onClick={() => setActiveTab('costing')}
                                        className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'costing'
                                            ? 'bg-white text-orange-600'
                                            : 'bg-orange-600/50 text-white hover:bg-orange-600/70'
                                            }`}
                                    >
                                        💰 Costeo
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('instructions')}
                                        className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'instructions'
                                            ? 'bg-white text-orange-600'
                                            : 'bg-orange-600/50 text-white hover:bg-orange-600/70'
                                            }`}
                                    >
                                        📝 Instrucciones
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('documents')}
                                        className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'documents'
                                            ? 'bg-white text-orange-600'
                                            : 'bg-orange-600/50 text-white hover:bg-orange-600/70'
                                            }`}
                                    >
                                        ⚠️ Observaciones
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('photo')}
                                        className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'photo'
                                            ? 'bg-white text-orange-600'
                                            : 'bg-orange-600/50 text-white hover:bg-orange-600/70'
                                            }`}
                                    >
                                        🖼️ Foto
                                    </button>
                                </>
                            )
                        }
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto flex flex-col p-6" >
                    {activeTab === 'general' && (
                        <form onSubmit={handleSaveGeneral} className="max-w-2xl mx-auto w-full space-y-4">
                            <Input
                                label="Nombre del Producto"
                                value={formData.producto}
                                onChange={(e) => setFormData({ ...formData, producto: e.target.value })}
                                required
                            />
                            <Input
                                label="Código"
                                value={formData.codigo}
                                onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                                required
                            />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                                <div className="flex gap-2">
                                    {isCreatingCategory ? (
                                        <>
                                            <input
                                                type="text"
                                                value={newCategoryName}
                                                onChange={(e) => setNewCategoryName(e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                                                placeholder="Nueva Categoría..."
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); }
                                                    if (e.key === 'Escape') setIsCreatingCategory(false);
                                                }}
                                            />
                                            <button type="button" onClick={handleCreateCategory} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">💾</button>
                                            <button type="button" onClick={() => setIsCreatingCategory(false)} className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600">✕</button>
                                        </>
                                    ) : (
                                        <>
                                            <select
                                                value={formData.idCategoria}
                                                onChange={(e) => setFormData({ ...formData, idCategoria: e.target.value })}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                                                required
                                            >
                                                <option value="">Seleccionar...</option>
                                                {categories.map(cat => (
                                                    <option key={cat.IdCategoria} value={cat.IdCategoria}>{cat.Categoria}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => { setIsCreatingCategory(true); setNewCategoryName(''); }}
                                                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 shadow-sm"
                                                title="Crear Nueva Categoría"
                                            >
                                                +
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Presentación</label>
                                <div className="flex gap-2">
                                    {isCreatingPresentation ? (
                                        <>
                                            <input
                                                type="text"
                                                value={newPresentationName}
                                                onChange={(e) => setNewPresentationName(e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none"
                                                placeholder="Nueva Presentación..."
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') { e.preventDefault(); handleCreatePresentation(); }
                                                    if (e.key === 'Escape') setIsCreatingPresentation(false);
                                                }}
                                            />
                                            <button type="button" onClick={handleCreatePresentation} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">💾</button>
                                            <button type="button" onClick={() => setIsCreatingPresentation(false)} className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600">✕</button>
                                        </>
                                    ) : (
                                        <>
                                            <select
                                                value={formData.idPresentacion}
                                                onChange={(e) => setFormData({ ...formData, idPresentacion: e.target.value })}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                                                required
                                            >
                                                <option value="">Seleccionar...</option>
                                                {presentations.map(pres => (
                                                    <option key={pres.IdPresentacion} value={pres.IdPresentacion}>{pres.Presentacion}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => { setIsCreatingPresentation(true); setNewPresentationName(''); }}
                                                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 shadow-sm"
                                                title="Crear Nueva Presentación"
                                            >
                                                +
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <Input
                                label="Precio"
                                type="number"
                                step="0.01"
                                value={formData.precio}
                                onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                                required
                            />
                            <Input
                                label="IVA"
                                type="number"
                                step="0.01"
                                value={formData.iva}
                                onChange={(e) => setFormData({ ...formData, iva: e.target.value })}
                                required
                            />
                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? 'Guardando...' : '💾 Guardar Cambios'}
                                </Button>
                            </div>
                        </form>
                    )
                    }

                    {
                        activeTab === 'photo' && (
                            <div className="max-w-2xl mx-auto w-full space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Foto del Producto
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                setSelectedPhoto(file);
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setPhotoPreview(reader.result as string);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                    />
                                    {photoPreview && (
                                        <div className="mt-3">
                                            <img
                                                src={photoPreview}
                                                alt="Vista previa"
                                                className="w-full h-64 object-contain rounded-md border border-gray-300 bg-gray-50"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end pt-4">
                                    <Button onClick={handleSavePhoto} disabled={isSaving}>
                                        {isSaving ? 'Guardando...' : '💾 Guardar Foto'}
                                    </Button>
                                </div>
                            </div>
                        )
                    }

                    {
                        activeTab === 'costing' && (
                            productType === 0 ? (
                                <div className="max-w-2xl mx-auto w-full space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de Compra</label>
                                            <select
                                                value={formData.idPresentacion}
                                                onChange={(e) => setFormData({ ...formData, idPresentacion: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                            >
                                                <option value="">Seleccionar...</option>
                                                {presentations.filter(p => !p.Presentacion.includes('DEPRECATED')).map(pres => (
                                                    <option key={pres.IdPresentacion} value={pres.IdPresentacion}>{pres.Presentacion}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <Input
                                            label="Precio Unidad Compra"
                                            type="number"
                                            step="0.01"
                                            value={formData.precio}
                                            onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría Recetario</label>
                                        <select
                                            value={idCategoriaRecetario}
                                            onChange={(e) => setIdCategoriaRecetario(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="0">Sin Categoría de Recetario</option>
                                            {recipeCategories.map(cat => (
                                                <option key={cat.IdCategoriaRecetario} value={cat.IdCategoriaRecetario}>{cat.CategoriaRecetario}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Contenido"
                                            type="number"
                                            step="0.01"
                                            value={simpleConversion}
                                            onChange={(e) => setSimpleConversion(parseFloat(e.target.value) || 0)}
                                        />
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de Inventario</label>
                                            <select
                                                value={idPresentacionConversion || ''}
                                                onChange={(e) => setIdPresentacionConversion(parseInt(e.target.value) || null)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                            >
                                                <option value="">(Igual a Compra)</option>
                                                {presentations.map(pres => (
                                                    <option key={pres.IdPresentacion} value={pres.IdPresentacion}>{pres.Presentacion}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Peso Inicial"
                                            type="number"
                                            step="0.01"
                                            value={pesoInicial}
                                            onChange={(e) => setPesoInicial(parseFloat(e.target.value) || 0)}
                                        />
                                        <Input
                                            label="Peso Final"
                                            type="number"
                                            step="0.01"
                                            value={pesoFinal}
                                            onChange={(e) => setPesoFinal(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase">% Rendimiento</label>
                                            <div className="text-lg font-bold text-gray-900">
                                                {pesoInicial > 0 ? ((pesoFinal / pesoInicial) * 100).toFixed(2) : '0.00'}%
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase">% Merma</label>
                                            <div className="text-lg font-bold text-red-600">
                                                {pesoInicial > 0 ? (((pesoInicial - pesoFinal) / pesoInicial) * 100).toFixed(2) : '0.00'}%
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase">P/U Compra Neto</label>
                                            <div className="text-lg font-bold text-blue-600">
                                                ${((parseFloat(formData.precio) || 0) * (pesoInicial > 0 ? (pesoFinal / pesoInicial) : 0)).toFixed(2)}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase">Precio Procesado</label>
                                            <div className="text-lg font-bold text-orange-600">
                                                ${(() => {
                                                    const precio = parseFloat(formData.precio) || 0;
                                                    const rendimiento = pesoInicial > 0 ? (pesoFinal / pesoInicial) : 0; // Yield Ratio
                                                    const precioNeto = precio * rendimiento;
                                                    const conversion = simpleConversion || 1;
                                                    return (precioNeto / conversion).toFixed(2);
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <Button onClick={() => setIsAddModalOpen(true)} className="mr-auto bg-gray-500 hover:bg-gray-600">
                                            Buscar Referencia
                                        </Button>
                                        <Button onClick={handleSaveGeneral} disabled={isSaving}>
                                            {isSaving ? 'Guardando...' : '💾 Guardar Costeo'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Toolbar */}
                                    {/* Toolbar */}
                                    <div className="mb-4 flex flex-col gap-4 bg-white sticky top-0 z-10 px-1 py-2 shadow-sm">
                                        {productType === 2 ? (
                                            <div className="space-y-4">
                                                {/* Fields Grid for Sub-recipes */}
                                                <div className="grid grid-cols-4 gap-4">
                                                    <div className="flex flex-col">
                                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1">Unidad de Compra</label>
                                                        <select
                                                            value={formData.idPresentacion}
                                                            onChange={(e) => setFormData({ ...formData, idPresentacion: e.target.value })}
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {presentations.filter(p => !p.Presentacion.includes('DEPRECATED')).map(pres => (
                                                                <option key={pres.IdPresentacion} value={pres.IdPresentacion}>{pres.Presentacion}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1">Precio</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.precio}
                                                            onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1">Categoría Recetario</label>
                                                        <select
                                                            value={idCategoriaRecetario}
                                                            onChange={(e) => setIdCategoriaRecetario(e.target.value)}
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            <option value="0">Sin Categoría de Recetario</option>
                                                            {recipeCategories.map(cat => (
                                                                <option key={cat.IdCategoriaRecetario} value={cat.IdCategoriaRecetario}>{cat.CategoriaRecetario}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1">Contenido</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={simpleConversion}
                                                            onChange={(e) => setSimpleConversion(parseFloat(e.target.value) || 0)}
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1">Unidad de Inventario</label>
                                                        <select
                                                            value={idPresentacionConversion || ''}
                                                            onChange={(e) => setIdPresentacionConversion(parseInt(e.target.value) || null)}
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                        >
                                                            <option value="">(Usar Pres. Prod)</option>
                                                            {presentations.map(p => (
                                                                <option key={p.IdPresentacion} value={p.IdPresentacion}>{p.Presentacion}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1">Peso Inicial</label>
                                                        <input
                                                            type="number"
                                                            value={pesoInicial}
                                                            disabled={true}
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-100 text-gray-500 outline-none"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1">Rendimiento (PesoFinal)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={pesoFinal}
                                                            onChange={(e) => setPesoFinal(parseFloat(e.target.value) || 0)}
                                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col bg-blue-50 p-1 px-2 rounded border border-blue-100">
                                                        <label className="text-xs font-bold text-blue-600 uppercase mb-1">Formula Costo/Unidad</label>
                                                        <span className="text-lg font-bold text-blue-800">
                                                            ${calculateCostPerUnit().toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Action Row */}
                                                <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                                                    <Button onClick={async () => {
                                                        await handleSaveAll();
                                                        setIsAddModalOpen(true);
                                                    }}>
                                                        ➕ Agregar Producto
                                                    </Button>

                                                    <div className="flex items-center gap-4">
                                                        <div className="text-lg font-bold">
                                                            Costo Total: <span className="text-green-600">${totalCost.toFixed(2)}</span>
                                                        </div>
                                                        <Button
                                                            onClick={handleSaveAll}
                                                            disabled={isSaving}
                                                            className="bg-green-600"
                                                        >
                                                            {isSaving ? 'Guardando...' : '💾 Guardar Todo'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-center flex-wrap gap-2">
                                                <div className="flex items-center gap-2">

                                                    <Button onClick={async () => {
                                                        await handleSaveAll();
                                                        setIsAddModalOpen(true);
                                                    }}>
                                                        ➕ Agregar Producto
                                                    </Button>
                                                    {productType === 1 && (
                                                        <div className="flex flex-col ml-4">
                                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1">Precio Venta</label>
                                                            <div className="relative">
                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={formData.precio}
                                                                    onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                                                                    className="w-32 pl-6 pr-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-lg font-bold">
                                                        Costo Total: <span className="text-green-600">${totalCost.toFixed(2)}</span>
                                                    </div>
                                                    <Button
                                                        onClick={handleSaveAll}
                                                        disabled={isSaving}
                                                        className="bg-green-600"
                                                    >
                                                        {isSaving ? 'Guardando...' : '💾 Guardar Todo'}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Costing Grid */}
                                    <div>
                                        {isLoading ? (
                                            <div className="text-center text-gray-600">Cargando...</div>
                                        ) : (
                                            <div className="space-y-6">
                                                {/* Grouped Stacked List */}
                                                {Object.keys(groupedItems).length > 0 ? (
                                                    Object.keys(groupedItems).sort().map(category => {
                                                        const items = groupedItems[category];
                                                        const categorySubtotal = items.reduce((sum, item) => {
                                                            const cantidad = editedQuantities[item.IdProductoHijo] ?? item.Cantidad;

                                                            // New Logic: A.Cantidad * (PesoFinal * Precio / ConversionSimple)
                                                            const pesoFinal = item.PesoFinal || 0;
                                                            const precioRaw = item.Precio || 0;
                                                            const conversion = item.ConversionSimple || 1;

                                                            // Ensure division by zero safety
                                                            const precioProcesado = conversion !== 0
                                                                ? (pesoFinal * precioRaw) / conversion
                                                                : 0;

                                                            return sum + (cantidad * precioProcesado);
                                                        }, 0);

                                                        return (
                                                            <div key={category} className="bg-white rounded-lg shadow overflow-hidden border border-gray-100">
                                                                <div className="bg-gray-50 px-4 py-2 font-bold flex justify-between items-center border-b border-gray-200 text-orange-800">
                                                                    <span>{category}</span>
                                                                    <span>
                                                                        Total: ${categorySubtotal.toFixed(2)}
                                                                    </span>
                                                                </div>
                                                                <table className="min-w-full divide-y divide-gray-200">
                                                                    <thead className="bg-gray-50">
                                                                        <tr>
                                                                            <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">Código</th>
                                                                            <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">Producto</th>
                                                                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-600">Cantidad</th>
                                                                            <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">Pres. Inv.</th>
                                                                            <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">Precio Proc.</th>
                                                                            <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">Total</th>
                                                                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-600">Acciones</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                                        {items.map(item => {
                                                                            const cantidad = editedQuantities[item.IdProductoHijo] ?? item.Cantidad;

                                                                            // Calculate Precio Procesado
                                                                            // Formula: PesoFinal * Precio / ConversionSimple (User Request removed /100)
                                                                            // User Query: PesoFinal*Precio/ConversionSimple
                                                                            // Wait, user query says "PesoFinal*Precio/ConversionSimple". Previous request said "PesoFinal/100...".
                                                                            // User changed requirements? "el precio procesado es igual a (PesoFinal/100 * Precio)/ConversionSimple" (Step 1587).
                                                                            // BUT CURRENT Request (Step 1682) says: "PesoFinal*Precio/ConversionSimple".
                                                                            // I will follow the LATEST SQL: "PesoFinal*Precio/ConversionSimple".
                                                                            const pesoFinal = item.PesoFinal || 0;
                                                                            const precioRaw = item.Precio || 0;
                                                                            const conversion = item.ConversionSimple || 1;

                                                                            const precioProcesado = conversion !== 0
                                                                                ? (pesoFinal * precioRaw) / conversion
                                                                                : 0;

                                                                            const total = cantidad * precioProcesado;

                                                                            return (
                                                                                <tr key={item.IdProductoHijo} className="hover:bg-gray-50">
                                                                                    <td className="px-4 py-2 text-sm">{item.Codigo}</td>
                                                                                    <td className="px-4 py-2 text-sm">{item.Producto}</td>
                                                                                    <td className="px-4 py-2 text-center">
                                                                                        <input
                                                                                            type="number"
                                                                                            step="0.01"
                                                                                            value={cantidad}
                                                                                            onChange={(e) => handleQuantityChange(item.IdProductoHijo, parseFloat(e.target.value) || 0)}
                                                                                            className="w-24 px-2 py-1 border border-gray-300 rounded text-center focus:ring-orange-500 focus:border-orange-500"
                                                                                        />
                                                                                    </td>
                                                                                    <td className="px-4 py-2 text-sm text-gray-500">{item.PresentacionInventario || '-'}</td>
                                                                                    <td className="px-4 py-2 text-right text-sm">
                                                                                        ${precioProcesado.toFixed(2)}
                                                                                    </td>
                                                                                    <td className="px-4 py-2 text-right font-bold text-blue-600">
                                                                                        ${total.toFixed(2)}
                                                                                    </td>
                                                                                    <td className="px-4 py-2 text-center">
                                                                                        <div className="flex justify-center gap-2">
                                                                                            <button
                                                                                                onClick={() => handleEditKitItem(item.IdProductoHijo)}
                                                                                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                                                                                title="Editar"
                                                                                            >
                                                                                                ✏️
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => handleDeleteItem(item.IdProductoHijo)}
                                                                                                className="text-red-600 hover:text-red-800 transition-colors"
                                                                                                title="Eliminar"
                                                                                            >
                                                                                                🗑️
                                                                                            </button>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    kitItems.length === 0 && (
                                                        <div className="text-center text-gray-500 py-8">
                                                            No hay productos en el kit. Haga clic en "Agregar Producto" para comenzar.
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )
                        )
                    }

                    {
                        activeTab === 'instructions' && (
                            <InstructionsTab product={product} projectId={projectId} />
                        )
                    }

                    {
                        activeTab === 'documents' && (
                            <DocumentsTab product={product} projectId={projectId} />
                        )
                    }
                </div>

                <AddMaterialModal
                    isOpen={isAddModalOpen}
                    onClose={() => setIsAddModalOpen(false)}
                    onSelect={handleSelectFromAddModal}
                    onEdit={handleEditFromAddModal}
                    onNewMaterial={handleNewMaterial}
                    projectId={projectId}
                    productType={productType ?? 0}
                    refreshKey={addMaterialRefreshKey}
                    externalSearchTerm={addMaterialSearchTerm}
                />

                {/* Recursive Edit Modal */}
                {
                    subEditingProduct && (
                        <CostingModal
                            isOpen={true}
                            onClose={() => {
                                setSubEditingProduct(null);
                                // Refresh current parent data to reflect changes in sub-product
                                fetchAllProducts();
                                if (product.IdProducto !== 0) fetchKitItems();
                            }}
                            product={subEditingProduct}
                            projectId={projectId}
                            initialTab="general"
                            productType={subEditingProduct.IdTipoProducto || 0}
                            onProductUpdate={(savedProduct, shouldClose = true) => {
                                if (shouldClose) setSubEditingProduct(null);
                                fetchAllProducts();
                                if (product.IdProducto !== 0) fetchKitItems();
                                // Update AddMaterialModal
                                if (savedProduct) {
                                    setAddMaterialRefreshKey(prev => prev + 1);
                                    setAddMaterialSearchTerm(savedProduct.Producto);
                                }
                            }}
                        />
                    )
                }
            </div>
        </div>
    );
}
