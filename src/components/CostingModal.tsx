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
    Costo: number;
    IdCategoriaRecetario?: number;
    CategoriaRecetario?: string;
    PresentacionInventario: string;
    Total?: number;
    ArchivoImagen?: string;
    NombreArchivo?: string;
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
    ArchivoImagen?: string;
    NombreArchivo?: string;
    IdTipoProducto?: number;
    ConversionSimple?: number;
    IdPresentacionConversion?: number;
    PesoFinal?: number; // Used for Yield (Rendimiento) storage
    PesoInicial?: number;
    ObservacionesMerma?: string;
    IdSeccionMenu?: number;
    PorcentajeCostoIdeal?: number;
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

interface MenuSection {
    IdSeccionMenu: number;
    SeccionMenu: string;
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
                precio: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(initialProduct.Precio || 0),
                iva: (initialProduct.IVA || 0).toString()
            });
            setPhotoPreview(initialProduct.ArchivoImagen || null);
            setSelectedPhotoBase64(initialProduct.ArchivoImagen || null);
            // Initialize sub-recipe state
            setPesoFinal(initialProduct.PesoFinal || 1);
            setPesoInicial(productType === 2 ? 1 : (initialProduct.PesoInicial || 1));
            setIdCategoriaRecetario(initialProduct.IdCategoriaRecetario?.toString() || '');
            setIdSeccionMenu(initialProduct.IdSeccionMenu?.toString() || '');
            setPorcentajeCostoIdeal(initialProduct.PorcentajeCostoIdeal?.toString() || '');
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
            setIdSeccionMenu('');
            setPorcentajeCostoIdeal('');
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
    const [idSeccionMenu, setIdSeccionMenu] = useState<string>('');
    const [porcentajeCostoIdeal, setPorcentajeCostoIdeal] = useState<string>('');
    const [simpleConversion, setSimpleConversion] = useState<number>(0);
    const [idPresentacionConversion, setIdPresentacionConversion] = useState<number | null>(null);

    // New State for General Config & Photo
    const [categories, setCategories] = useState<Category[]>([]);
    const [recipeCategories, setRecipeCategories] = useState<RecipeCategory[]>([]);
    const [presentations, setPresentations] = useState<Presentation[]>([]);
    const [menuSections, setMenuSections] = useState<MenuSection[]>([]);
    const [formData, setFormData] = useState({
        producto: product.Producto,
        codigo: product.Codigo || '',
        idCategoria: product.IdCategoria?.toString() || product.IdCategoriaRecetario?.toString() || '',
        idPresentacion: product.IdPresentacion?.toString() || '',
        precio: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(product.Precio || 0),
        iva: product.IVA.toString()
    });
    const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(product.ArchivoImagen || null);
    const [selectedPhotoBase64, setSelectedPhotoBase64] = useState<string | null>(product.ArchivoImagen || null);

    // Recursive Editing State
    const [subEditingProduct, setSubEditingProduct] = useState<Product | null>(null);

    // Quick Create State
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isCreatingPresentation, setIsCreatingPresentation] = useState(false);
    const [newPresentationName, setNewPresentationName] = useState('');
    const [isCreatingMenuSection, setIsCreatingMenuSection] = useState(false);
    const [newMenuSectionName, setNewMenuSectionName] = useState('');

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
            fetchMenuSections();
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

    const fetchMenuSections = async () => {
        try {
            const response = await fetch(`/api/production/menu-sections?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) setMenuSections(data.data);
        } catch (error) {
            console.error('Error fetching menu sections:', error);
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
        const finalItem: KitItem = {
            IdProductoPadre: product.IdProducto,
            IdProductoHijo: selectedProduct.IdProducto,
            Cantidad: 1,
            Codigo: selectedProduct.Codigo,
            Producto: selectedProduct.Producto,
            Costo: selectedProduct.Costo || selectedProduct.Precio || 0,
            IdCategoriaRecetario: selectedProduct.IdCategoriaRecetario,
            CategoriaRecetario: selectedProduct.CategoriaRecetario || 'Sin Módulo de Recetario',
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
                        precio: productType === 2 ? 0 : parseFloat(formData.precio.replace(/[^0-9.]/g, '') || '0'),
                        iva: productType === 2 ? 0 : parseFloat(formData.iva || '0'),
                        // New fields
                        conversionSimple: simpleConversion,
                        idPresentacionConversion: finalIdPresentacionConversion,
                        pesoFinal: pesoFinal, // Mapping Yield to PesoFinal
                        pesoInicial: pesoInicial,
                        idCategoriaRecetario: idCategoriaRecetario === '' ? null : parseInt(idCategoriaRecetario),
                        idTipoProducto: productType, // Ensure backend knows the type
                        archivoImagen: selectedPhotoBase64,
                        nombreArchivo: selectedPhoto?.name || product.NombreArchivo,

                        // Ensure required fields are present if formData is incomplete (fallback to product)
                        producto: formData.producto || product.Producto,
                        codigo: formData.codigo || product.Codigo,
                        rutaFoto: product.RutaFoto,
                        // Dishes specific fields
                        idSeccionMenu: idSeccionMenu === '' ? null : parseInt(idSeccionMenu),
                        porcentajeCostoIdeal: porcentajeCostoIdeal === '' ? null : parseFloat(porcentajeCostoIdeal),
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
                const savedPrecio = (formData.precio && typeof formData.precio === 'string')
                    ? parseFloat(formData.precio.replace(/[^0-9.]/g, ''))
                    : (product.Precio || 0);

                onProductUpdate?.({
                    ...product,
                    ...formData,
                    Precio: savedPrecio,
                    IVA: parseFloat(formData.iva || '0'),
                    IdProducto: product.IdProducto,
                    PesoFinal: pesoFinal,
                    PesoInicial: pesoInicial,
                    ConversionSimple: simpleConversion,
                    IdPresentacionConversion: idPresentacionConversion
                } as any);
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

    const handleCreateMenuSection = async () => {
        if (!newMenuSectionName.trim()) return;
        try {
            const response = await fetch('/api/production/menu-sections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, seccionMenu: newMenuSectionName })
            });
            const data = await response.json();
            if (data.success) {
                const newSection = { IdSeccionMenu: data.id, SeccionMenu: newMenuSectionName };
                setMenuSections([...menuSections, newSection]);
                setIdSeccionMenu(data.id.toString());
                setIsCreatingMenuSection(false);
                setNewMenuSectionName('');
            }
        } catch (error) {
            console.error('Error creating menu section:', error);
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
                    precio: productType === 2 ? 0 : parseFloat(formData.precio.replace(/[^0-9.]/g, '') || '0'),
                    iva: productType === 2 ? 0 : parseFloat(formData.iva || '0'),
                    idTipoProducto: productType ?? product.IdTipoProducto ?? 1,
                    conversionSimple: simpleConversion,
                    idPresentacionConversion: idPresentacionConversion,
                    pesoFinal: pesoFinal,
                    pesoInicial: pesoInicial,
                    idCategoriaRecetario: idCategoriaRecetario === '' ? null : parseInt(idCategoriaRecetario),
                    idSeccionMenu: idSeccionMenu === '' ? null : parseInt(idSeccionMenu),
                    porcentajeCostoIdeal: porcentajeCostoIdeal === '' ? null : parseFloat(porcentajeCostoIdeal),
                    rutaFoto: product.RutaFoto, // Keep existing photo
                    archivoImagen: selectedPhotoBase64, // Include base64 image data
                    nombreArchivo: selectedPhoto?.name || product.NombreArchivo,
                })
            });

            if (response.ok) {
                const data = await response.json();

                if (isNew && data.id) {
                    alert('Producto creado exitosamente.');
                    // Update local state to "saved" mode without closing
                    const newProduct: Product = {
                        ...product,
                        IdProducto: data.id,
                        ...formData,
                        Producto: formData.producto,
                        Codigo: formData.codigo,
                        IdCategoria: parseInt(formData.idCategoria),
                        IdPresentacion: parseInt(formData.idPresentacion),
                        Precio: parseFloat(formData.precio.replace(/[^0-9.]/g, '')),
                        IVA: parseFloat(formData.iva),
                        PesoInicial: pesoInicial,
                        PesoFinal: pesoFinal,
                        ConversionSimple: simpleConversion,
                        IdPresentacionConversion: idPresentacionConversion || undefined,
                        IdCategoriaRecetario: idCategoriaRecetario === '' ? undefined : parseInt(idCategoriaRecetario),
                        IdSeccionMenu: idSeccionMenu === '' ? undefined : parseInt(idSeccionMenu),
                        PorcentajeCostoIdeal: porcentajeCostoIdeal === '' ? undefined : parseFloat(porcentajeCostoIdeal),
                        ArchivoImagen: selectedPhotoBase64 || undefined,
                        NombreArchivo: selectedPhoto?.name || product.NombreArchivo,
                    };
                    setProduct(newProduct);
                    // Call parent update and close (shouldClose = true)
                    if (onProductUpdate) onProductUpdate(newProduct, true);
                } else {
                    alert('Información general actualizada exitosamente');
                    const updatedProduct: Product = {
                        ...product,
                        ...formData,
                        Producto: formData.producto,
                        Codigo: formData.codigo,
                        IdCategoria: parseInt(formData.idCategoria),
                        IdPresentacion: parseInt(formData.idPresentacion),
                        Precio: parseFloat(formData.precio.replace(/[^0-9.]/g, '')),
                        IVA: parseFloat(formData.iva),
                        PesoInicial: pesoInicial,
                        PesoFinal: pesoFinal,
                        ConversionSimple: simpleConversion,
                        IdPresentacionConversion: idPresentacionConversion || undefined,
                        IdCategoriaRecetario: idCategoriaRecetario === '' ? undefined : parseInt(idCategoriaRecetario),
                        IdSeccionMenu: idSeccionMenu === '' ? undefined : parseInt(idSeccionMenu),
                        PorcentajeCostoIdeal: porcentajeCostoIdeal === '' ? undefined : parseFloat(porcentajeCostoIdeal),
                        ArchivoImagen: selectedPhotoBase64 || undefined,
                        NombreArchivo: selectedPhoto?.name || product.NombreArchivo,
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

    const handleSavePhoto = async (photoBase64?: string, photoName?: string) => {
        setIsSaving(true);
        try {
            const finalBase64 = photoBase64 || selectedPhotoBase64;
            const finalName = photoName || selectedPhoto?.name || product.NombreArchivo;

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
                    precio: productType === 2 ? 0 : parseFloat(formData.precio.replace(/[^0-9.]/g, '') || '0'),
                    iva: productType === 2 ? 0 : parseFloat(formData.iva || '0'),
                    idTipoProducto: productType ?? 1,
                    conversionSimple: simpleConversion,
                    idPresentacionConversion: idPresentacionConversion,
                    pesoFinal: pesoFinal,
                    pesoInicial: pesoInicial,
                    idCategoriaRecetario: idCategoriaRecetario === '' ? null : parseInt(idCategoriaRecetario),
                    rutaFoto: product.RutaFoto, // Keep existing photo
                    archivoImagen: finalBase64, // Send base64 string
                    nombreArchivo: finalName,
                })
            });

            if (response.ok) {
                alert('Foto actualizada exitosamente');
                const updatedProduct: Product = {
                    ...product,
                    ArchivoImagen: finalBase64 || undefined,
                    NombreArchivo: finalName,
                };
                setProduct(updatedProduct);
                if (onProductUpdate) onProductUpdate(updatedProduct, false);
                setSelectedPhoto(null); // Reset selection state after auto-save
            }
        } catch (error) {
            console.error('Error saving photo:', error);
            alert('Error al guardar la foto');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedPhoto(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setPhotoPreview(base64String);
                setSelectedPhotoBase64(base64String);
                // Automate Save
                handleSavePhoto(base64String, file.name);
            };
            reader.readAsDataURL(file);
        }
    };

    const groupedItems = kitItems.reduce((acc, item) => {
        const categoria = item.CategoriaRecetario || 'Sin Módulo de Recetario';
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
        const costoUnitario = item.Costo || 0;
        return sum + (cantidad * costoUnitario);
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
                const costoUnitario = item.Costo || 0;
                return sum + (cantidad * costoUnitario);
            }, 0);

            const rendimientoVal = pesoInicial > 0 ? (pesoFinal / pesoInicial) * 100 : 0;
            const mermaVal = pesoInicial > 0 ? ((pesoInicial - pesoFinal) / pesoInicial) * 100 : 0;
            const puCompraNeto = pesoInicial > 0 ? ((parseFloat(formData.precio.replace(/,/g, '')) || 0) * (pesoFinal / pesoInicial)) : 0; // Price * Yield Ratio
            // Price Processed Header Calculation: (PU Compra Neto) / Conversion
            const precioProcesadoHeader = simpleConversion !== 0 ? (puCompraNeto / simpleConversion) : 0;

            const headerData: CostingHeaderData = {
                unidadCompra: presentations.find(p => p.IdPresentacion.toString() === formData.idPresentacion)?.Presentacion,
                precio: parseFloat(formData.precio.replace(/,/g, '')) || 0,
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
                const costoUnitario = item.Costo || 0;

                return {
                    Codigo: item.Codigo,
                    Producto: item.Producto,
                    Categoria: '', // Not returned by API
                    CategoriaRecetario: item.CategoriaRecetario,
                    Presentacion: '', // Not returned by API
                    Cantidad: cantidad,
                    Precio: costoUnitario, // Alias for PDF compatibility
                    PresentacionInventario: item.PresentacionInventario,
                    PesoFinal: 0, // Not returned by API
                    ConversionSimple: 0, // Not returned by API
                    PrecioProcesado: costoUnitario,
                    Total: cantidad * costoUnitario
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
            <div className="bg-white w-[70vw] h-[85vh] rounded-lg shadow-lg flex flex-col">
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
                                {productType !== 2 && (
                                    <div className="flex items-center gap-1">
                                        <span className="opacity-70">Precio Menú:</span>
                                        <span className="font-semibold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.Precio || 0)}</span>
                                    </div>
                                )}
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

                        {/* Info Boxes - Only show in Costing Tab and NOT for Sub-recipes */}
                        {
                            activeTab === 'costing' && productType !== 2 && (
                                <div className="flex gap-3">
                                    {/* % Impuesto */}
                                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 min-w-[140px]">
                                        <h3 className="text-xs font-bold mb-1">% Impuesto</h3>
                                        <p className="text-[10px] opacity-90">IVA: {parseFloat(formData.iva) || 0}%</p>
                                        <p className="text-lg font-bold">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((parseFloat(formData.precio.replace(/[^0-9.]/g, '')) || 0) * ((parseFloat(formData.iva) || 0) / 100))}
                                        </p>
                                    </div>

                                    {/* % Costo Precio con IVA */}
                                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 min-w-[140px]">
                                        <h3 className="text-xs font-bold mb-1">% Costo/Precio</h3>
                                        <p className="text-[10px] opacity-90">con IVA</p>
                                        <p className="text-lg font-bold">
                                            {(() => {
                                                const price = parseFloat(formData.precio.replace(/,/g, '')) || 0;
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
                                                const price = parseFloat(formData.precio.replace(/,/g, '')) || 0;
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
                        <form onSubmit={handleSaveGeneral} className="max-w-4xl mx-auto w-full space-y-6">
                            {/* Row 1: Nombre y Código */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            </div>

                            {/* Row 2: Categoría, Presentación y Modulo de Recetario (OR Seccion de Menu for Dishes) */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[72px]">
                                {productType === 1 ? (
                                    <>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Sección de Menú</label>
                                            <div className="flex gap-2 h-full">
                                                {isCreatingMenuSection ? (
                                                    <div className="flex gap-2 w-full h-[38px]">
                                                        <input
                                                            type="text"
                                                            value={newMenuSectionName}
                                                            onChange={(e) => setNewMenuSectionName(e.target.value)}
                                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none h-full"
                                                            placeholder="Nueva Sección..."
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') { e.preventDefault(); handleCreateMenuSection(); }
                                                                if (e.key === 'Escape') setIsCreatingMenuSection(false);
                                                            }}
                                                        />
                                                        <button type="button" onClick={handleCreateMenuSection} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 h-full">💾</button>
                                                        <button type="button" onClick={() => setIsCreatingMenuSection(false)} className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 h-full">✕</button>
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={idSeccionMenu}
                                                        onChange={(e) => {
                                                            if (e.target.value === 'NEW') {
                                                                setIsCreatingMenuSection(true);
                                                                setNewMenuSectionName('');
                                                            } else {
                                                                setIdSeccionMenu(e.target.value);
                                                            }
                                                        }}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md h-[38px]"
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {menuSections.map(sec => (
                                                            <option key={sec.IdSeccionMenu} value={sec.IdSeccionMenu}>{sec.SeccionMenu}</option>
                                                        ))}
                                                        <option value="NEW" className="font-bold text-orange-600">+ Agregar Nueva...</option>
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje Costo Ideal</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={porcentajeCostoIdeal}
                                                    onChange={(e) => setPorcentajeCostoIdeal(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md h-[38px] pr-8"
                                                    placeholder="0.00"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                                            <div className="flex gap-2 h-full">
                                                {isCreatingCategory ? (
                                                    <div className="flex gap-2 w-full h-[38px]">
                                                        <input
                                                            type="text"
                                                            value={newCategoryName}
                                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none h-full"
                                                            placeholder="Nueva Categoría..."
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); }
                                                                if (e.key === 'Escape') setIsCreatingCategory(false);
                                                            }}
                                                        />
                                                        <button type="button" onClick={handleCreateCategory} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 h-full">💾</button>
                                                        <button type="button" onClick={() => setIsCreatingCategory(false)} className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 h-full">✕</button>
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={formData.idCategoria}
                                                        onChange={(e) => {
                                                            if (e.target.value === 'NEW') {
                                                                setIsCreatingCategory(true);
                                                                setNewCategoryName('');
                                                            } else {
                                                                setFormData({ ...formData, idCategoria: e.target.value });
                                                            }
                                                        }}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md h-[38px]"
                                                        required
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {categories.map(cat => (
                                                            <option key={cat.IdCategoria} value={cat.IdCategoria}>{cat.Categoria}</option>
                                                        ))}
                                                        <option value="NEW" className="font-bold text-orange-600">+ Agregar Nueva...</option>
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Presentación</label>
                                            <div className="flex gap-2 h-full">
                                                {isCreatingPresentation ? (
                                                    <div className="flex gap-2 w-full h-[38px]">
                                                        <input
                                                            type="text"
                                                            value={newPresentationName}
                                                            onChange={(e) => setNewPresentationName(e.target.value)}
                                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 outline-none h-full"
                                                            placeholder="Nueva Presentación..."
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') { e.preventDefault(); handleCreatePresentation(); }
                                                                if (e.key === 'Escape') setIsCreatingPresentation(false);
                                                            }}
                                                        />
                                                        <button type="button" onClick={handleCreatePresentation} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 h-full">💾</button>
                                                        <button type="button" onClick={() => setIsCreatingPresentation(false)} className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 h-full">✕</button>
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={formData.idPresentacion}
                                                        onChange={(e) => {
                                                            if (e.target.value === 'NEW') {
                                                                setIsCreatingPresentation(true);
                                                                setNewPresentationName('');
                                                            } else {
                                                                setFormData({ ...formData, idPresentacion: e.target.value });
                                                            }
                                                        }}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md h-[38px]"
                                                        required
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {presentations.map(pres => (
                                                            <option key={pres.IdPresentacion} value={pres.IdPresentacion}>{pres.Presentacion}</option>
                                                        ))}
                                                        <option value="NEW" className="font-bold text-orange-600">+ Agregar Nueva...</option>
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Módulo de Recetario</label>
                                            <select
                                                value={idCategoriaRecetario}
                                                onChange={(e) => setIdCategoriaRecetario(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md h-[38px]"
                                            >
                                                <option value="">Seleccionar...</option>
                                                <option value="0">Sin Módulo de Recetario</option>
                                                {recipeCategories.map(cat => (
                                                    <option key={cat.IdCategoriaRecetario} value={cat.IdCategoriaRecetario}>{cat.CategoriaRecetario}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Row 3: Precio e IVA */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {productType !== 2 && (
                                    <>
                                        <Input
                                            label="Precio"
                                            type="text"
                                            value={formData.precio}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                if ((val.match(/\./g) || []).length > 1) return;
                                                setFormData({ ...formData, precio: val });
                                            }}
                                            onBlur={(e) => {
                                                const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '') || '0');
                                                if (!isNaN(val)) {
                                                    setFormData({ ...formData, precio: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) });
                                                }
                                            }}
                                            onFocus={(e) => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                if (val === '0.00' || val === '0') {
                                                    setFormData({ ...formData, precio: '' });
                                                } else {
                                                    setFormData({ ...formData, precio: val });
                                                }
                                            }}
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
                                    </>
                                )}
                            </div>
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
                            <div className="flex flex-col items-center justify-center space-y-6 py-8">
                                <div
                                    onClick={() => document.getElementById('photo-upload')?.click()}
                                    className="w-80 h-80 border-4 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all overflow-hidden relative group"
                                >
                                    {photoPreview ? (
                                        <>
                                            <img src={photoPreview} alt="Preview" className="w-full h-full object-fill" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <span className="text-white font-bold bg-orange-600 px-4 py-2 rounded-lg">Cambiar Imagen</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-6">
                                            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📸</div>
                                            <p className="text-gray-500 font-medium">Click para seleccionar una foto</p>
                                            <p className="text-gray-400 text-sm mt-2">Formatos: JPG, PNG, WEBP</p>
                                        </div>
                                    )}
                                </div>

                                <input
                                    type="file"
                                    id="photo-upload"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                    className="hidden"
                                />

                                {selectedPhoto && !isSaving && (
                                    <div className="flex gap-4">
                                        <Button
                                            onClick={() => {
                                                setSelectedPhoto(null);
                                                setPhotoPreview(product.ArchivoImagen || null);
                                                setSelectedPhotoBase64(product.ArchivoImagen || null);
                                            }}
                                            className="bg-gray-500 px-8 py-3 text-lg"
                                        >
                                            Cancelar
                                        </Button>
                                    </div>
                                )}
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
                                            type="text"
                                            value={formData.precio}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                if ((val.match(/\./g) || []).length > 1) return;
                                                setFormData({ ...formData, precio: val });
                                            }}
                                            onBlur={(e) => {
                                                const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '') || '0');
                                                if (!isNaN(val)) {
                                                    setFormData({ ...formData, precio: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) });
                                                }
                                            }}
                                            onFocus={(e) => {
                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                if (val === '0.00' || val === '0') {
                                                    setFormData({ ...formData, precio: '' });
                                                } else {
                                                    setFormData({ ...formData, precio: val });
                                                }
                                            }}
                                        />
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
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((parseFloat(formData.precio.replace(/[^0-9.]/g, '')) || 0) * (pesoInicial > 0 ? (pesoFinal / pesoInicial) : 0))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase">Precio Procesado</label>
                                            <div className="text-lg font-bold text-orange-600">
                                                {(() => {
                                                    const precio = parseFloat(formData.precio.replace(/[^0-9.]/g, '')) || 0;
                                                    const rendimiento = pesoInicial > 0 ? (pesoFinal / pesoInicial) : 0; // Yield Ratio
                                                    const precioNeto = precio * rendimiento;
                                                    const conversion = simpleConversion || 1;
                                                    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(precioNeto / conversion);
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
                                                    <div className="flex flex-col bg-gray-50 p-1 px-2 rounded border border-gray-100">
                                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1">Costo Total</label>
                                                        <span className="text-lg font-bold text-gray-900">
                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCost)}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1">Rendimiento (Peso Final)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={pesoFinal}
                                                            onChange={(e) => setPesoFinal(parseFloat(e.target.value) || 0)}
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
                                                    <div className="flex flex-col bg-blue-50 p-1 px-2 rounded border border-blue-100">
                                                        <label className="text-xs font-bold text-blue-600 uppercase mb-1">Formula Costo/Unidad</label>
                                                        <span className="text-lg font-bold text-blue-800">
                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateCostPerUnit())}
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
                                                                <input
                                                                    type="text"
                                                                    value={formData.precio}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                        if ((val.match(/\./g) || []).length > 1) return;
                                                                        setFormData({ ...formData, precio: val });
                                                                    }}
                                                                    onBlur={(e) => {
                                                                        const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '') || '0');
                                                                        if (!isNaN(val)) {
                                                                            setFormData({ ...formData, precio: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) });
                                                                        }
                                                                    }}
                                                                    onFocus={(e) => {
                                                                        const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                        if (val === '0.00' || val === '0') {
                                                                            setFormData({ ...formData, precio: '' });
                                                                        } else {
                                                                            setFormData({ ...formData, precio: val });
                                                                        }
                                                                    }}
                                                                    className="w-32 px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {productType === 1 && (
                                                        <>
                                                            <div className="flex flex-col bg-blue-50 p-1 px-2 rounded border border-blue-100 min-w-[80px]">
                                                                <label className="text-[10px] font-bold text-blue-600 uppercase mb-0.5">% Ideal</label>
                                                                <span className="text-sm font-bold text-blue-800">
                                                                    {(parseFloat(porcentajeCostoIdeal) || 0).toFixed(2)}%
                                                                </span>
                                                            </div>
                                                            <div className={`flex flex-col p-1 px-2 rounded border min-w-[80px] ${(totalCost / (parseFloat(formData.precio.replace(/[^0-9.]/g, '')) || 1) * 100) > (parseFloat(porcentajeCostoIdeal) || 0)
                                                                ? 'bg-red-50 border-red-100 text-red-800'
                                                                : 'bg-green-50 border-green-100 text-green-800'
                                                                }`}>
                                                                <label className="text-[10px] font-bold uppercase mb-0.5 opacity-70">
                                                                    % Costo {(totalCost / (parseFloat(formData.precio.replace(/[^0-9.]/g, '')) || 1) * 100) > (parseFloat(porcentajeCostoIdeal) || 0) && '⚠️'}
                                                                </label>
                                                                <span className="text-sm font-bold">
                                                                    {(totalCost / (parseFloat(formData.precio.replace(/[^0-9.]/g, '')) || 1) * 100).toFixed(2)}%
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}
                                                    <div className="text-lg font-bold">
                                                        Costo Total: <span className="text-green-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCost)}</span>
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
                                                            const costoUnitario = item.Costo || 0;
                                                            return sum + (cantidad * costoUnitario);
                                                        }, 0);

                                                        return (
                                                            <div key={category} className="bg-white rounded-lg shadow overflow-hidden border border-gray-100">
                                                                <div className="bg-gray-50 px-4 py-2 font-bold flex justify-between items-center border-b border-gray-200 text-orange-800">
                                                                    <span>{category}</span>
                                                                    <span>
                                                                        Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(categorySubtotal)}
                                                                    </span>
                                                                </div>
                                                                <table className="min-w-full divide-y divide-gray-200">
                                                                    <thead className="bg-gray-50">
                                                                        <tr>
                                                                            <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Código</th>
                                                                            <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Producto</th>
                                                                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-600 uppercase">Cantidad</th>
                                                                            <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Pres. Inv.</th>
                                                                            <th className="px-4 py-2 text-right text-xs font-bold text-gray-600 uppercase">Costo</th>
                                                                            <th className="px-4 py-2 text-right text-xs font-bold text-gray-600 uppercase">Total</th>
                                                                            <th className="px-4 py-2 text-center text-xs font-bold text-gray-600 uppercase">Acciones</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                                        {items.map(item => {
                                                                            const cantidad = editedQuantities[item.IdProductoHijo] ?? item.Cantidad;

                                                                            const costoUnitario = item.Costo || 0;
                                                                            const total = cantidad * costoUnitario;

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
                                                                                        ${costoUnitario.toFixed(2)}
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
