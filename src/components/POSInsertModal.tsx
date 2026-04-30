'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import Button from './Button';

interface POSItem {
    codigo: string;
    descripcion: string;
    categoria: string;
    cantidad: number;
    total: number;
    idProducto?: number;
}

interface Product {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    Precio: number;
    Categoria: string;
    SeccionMenu: string;
}

interface POSInsertModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (items: POSItem[]) => void;
    isSaving: boolean;
    projectId: number;
    initialItems?: POSItem[];
}

export default function POSInsertModal({ isOpen, onClose, onSave, isSaving, projectId, initialItems = [] }: POSInsertModalProps) {
    const { colors } = useTheme();
    const [mode, setMode] = useState<'pasted' | 'manual'>('manual');
    const [pastedText, setPastedText] = useState('');
    const [parsedItems, setParsedItems] = useState<POSItem[]>([]);

    // Manual mode state
    const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [manualQuantities, setManualQuantities] = useState<Record<number, string>>({});
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (isOpen && initialItems.length > 0) {
            const quantities: Record<number, string> = {};
            const manualOnly: POSItem[] = [];
            
            initialItems.forEach(item => {
                if (item.idProducto) {
                    quantities[item.idProducto] = item.cantidad.toString();
                } else {
                    // Items that were pasted (no idProducto)
                    manualOnly.push(item);
                }
            });
            
            setManualQuantities(quantities);
            setParsedItems(manualOnly);
        } else if (isOpen) {
            setManualQuantities({});
            setParsedItems([]);
            setPastedText('');
        }
    }, [isOpen]);

    const fetchProducts = async () => {
        if (!projectId) return;
        setIsLoadingProducts(true);
        try {
            const res = await fetch(`/api/products?projectId=${projectId}&tipoProducto=1`);
            const data = await res.json();
            if (data.success) {
                setAvailableProducts(data.data);
                const initialCollapsed: Record<string, boolean> = {};
                data.data.forEach((p: Product) => {
                    const sec = p.SeccionMenu || 'Otras Secciones';
                    initialCollapsed[sec] = false;
                });
                setCollapsedSections(initialCollapsed);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setIsLoadingProducts(false);
        }
    };

    useEffect(() => {
        if (isOpen && availableProducts.length === 0) {
            fetchProducts();
        }
    }, [isOpen]);

    const handleQuantityChange = (productId: number, value: string) => {
        setManualQuantities(prev => ({
            ...prev,
            [productId]: value
        }));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll('input[data-pos-input="true"]')) as HTMLInputElement[];
            const currentIndex = inputs.indexOf(e.currentTarget);
            if (currentIndex !== -1 && currentIndex < inputs.length - 1) {
                inputs[currentIndex + 1].focus();
                inputs[currentIndex + 1].select();
            }
        }
    };

    const handleParse = () => {
        const lines = pastedText.split('\n').filter(line => line.trim() !== '');
        const items: POSItem[] = [];

        lines.forEach(line => {
            let parts = line.split('\t');
            if (parts.length < 4) {
                parts = line.split(/\s{2,}/).map(p => p.trim());
            }

            if (parts.length >= 4) {
                const codigo = parts[0];
                const descripcion = parts[1];
                const categoria = parts[2];
                const cantidadStr = parts[3].replace(/,/g, '');
                const totalStr = (parts.length > 5 ? parts[5] : parts[4]).replace(/[^0-9.]/g, '');

                const cantidad = parseFloat(cantidadStr);
                const total = parseFloat(totalStr);

                if (!isNaN(cantidad) && !isNaN(total)) {
                    items.push({ codigo, descripcion, categoria, cantidad, total });
                }
            }
        });

        setParsedItems(items);
        setMode('pasted'); // Switch to view result
    };

    const filteredProducts = useMemo(() => {
        return availableProducts.filter(p => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return p.Producto.toLowerCase().includes(query) || p.Codigo.toLowerCase().includes(query);
        });
    }, [availableProducts, searchQuery]);

    const groupedProducts = useMemo(() => {
        return filteredProducts.reduce((acc, p) => {
            const sec = p.SeccionMenu || 'Otras Secciones';
            if (!acc[sec]) acc[sec] = [];
            acc[sec].push(p);
            return acc;
        }, {} as Record<string, Product[]>);
    }, [filteredProducts]);

    const handleConfirmSave = () => {
        let finalItems: POSItem[] = [...parsedItems];

        // Add manual items
        Object.entries(manualQuantities).forEach(([id, qtyStr]) => {
            const qty = parseFloat(qtyStr);
            if (qty > 0) {
                const product = availableProducts.find(p => p.IdProducto === parseInt(id));
                if (product) {
                    finalItems.push({
                        idProducto: product.IdProducto,
                        codigo: product.Codigo,
                        descripcion: product.Producto,
                        categoria: product.Categoria || 'MANUAL',
                        cantidad: qty,
                        total: qty * (product.Precio || 0)
                    });
                }
            }
        });

        onSave(finalItems);
    };

    if (!isOpen) return null;

    const totalFromManual = Object.entries(manualQuantities).reduce((sum, [id, qtyStr]) => {
        const qty = parseFloat(qtyStr) || 0;
        const p = availableProducts.find(prod => prod.IdProducto === parseInt(id));
        return sum + (qty * (p?.Precio || 0));
    }, 0);

    const totalFromPasted = parsedItems.reduce((sum, item) => sum + item.total, 0);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center text-white" 
                     style={{ background: `linear-gradient(to right, ${colors.colorFondo1}, ${colors.colorFondo2})`, color: colors.colorLetra }}>
                    <div>
                        <h2 className="text-2xl font-black flex items-center gap-2">
                            💳 Captura de Ventas POS
                        </h2>
                        <p className="text-sm opacity-90 font-medium">Reporte masivo o captura manual por platillo</p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 rounded-full p-2 transition-all">✕</button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/30">
                    {/* Mode Toggle */}
                    <div className="p-4 flex justify-center border-b border-gray-100 bg-white">
                        <div className="flex bg-gray-100 p-1 rounded-2xl w-fit">
                            <button
                                onClick={() => setMode('pasted')}
                                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${mode === 'pasted' ? 'bg-white shadow-md text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                📋 Reporte Pegado
                                {parsedItems.length > 0 && <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{parsedItems.length}</span>}
                            </button>
                            <button
                                onClick={() => setMode('manual')}
                                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${mode === 'manual' ? 'bg-white shadow-md text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                🍽️ Captura Manual
                                {Object.values(manualQuantities).filter(q => parseFloat(q) > 0).length > 0 && 
                                    <span className="bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                        {Object.values(manualQuantities).filter(q => parseFloat(q) > 0).length}
                                    </span>
                                }
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {mode === 'pasted' ? (
                            <div className="space-y-6">
                                {/* Paste Area */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Reporte POS (Texto)</label>
                                    <textarea
                                        className="w-full h-40 p-4 rounded-2xl border-2 border-gray-100 focus:border-primary-400 focus:ring-0 outline-none transition-all font-mono text-sm resize-none bg-white shadow-inner"
                                        placeholder="Pega aquí los datos...&#10;Ejemplo: P22  PROMO POLLO  POLLO  30.00  $  5,663.79"
                                        value={pastedText}
                                        onChange={(e) => setPastedText(e.target.value)}
                                    />
                                    <div className="flex justify-between items-center">
                                        <p className="text-[10px] text-gray-400 italic">* Soporta separadores por Tab o espacios múltiples</p>
                                        <Button 
                                            onClick={handleParse} 
                                            className="px-6 py-2 rounded-xl text-sm font-bold shadow-lg active:scale-95"
                                            style={{ background: colors.colorFondo1, color: colors.colorLetra }}
                                        >
                                            🔍 Procesar Reporte
                                        </Button>
                                    </div>
                                </div>

                                {/* Preview Table for Pasted */}
                                {parsedItems.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center px-1">
                                            <h3 className="font-black text-gray-800 uppercase tracking-tighter">Items Detectados</h3>
                                            <Button variant="outline" size="sm" onClick={() => setParsedItems([])} className="text-red-500">Limpiar</Button>
                                        </div>
                                        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                    <tr>
                                                        <th className="px-4 py-3">Cód/Desc</th>
                                                        <th className="px-4 py-3 text-right">Cant.</th>
                                                        <th className="px-4 py-3 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {parsedItems.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50 transition-colors text-xs">
                                                            <td className="px-4 py-2">
                                                                <div className="font-bold text-gray-800">{item.descripcion}</div>
                                                                <div className="text-[10px] text-gray-400">{item.codigo} • {item.categoria}</div>
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-medium">{item.cantidad}</td>
                                                            <td className="px-4 py-2 text-right font-black text-emerald-600">
                                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.total)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Search */}
                                <div className="sticky top-0 bg-gray-50/90 backdrop-blur-md z-10 pb-4">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Buscar platillo por nombre o código..."
                                            className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-white shadow-xl focus:border-primary-400 focus:ring-0 outline-none transition-all text-sm"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl opacity-40">🔍</span>
                                    </div>
                                </div>

                                {/* Product List Grouped by Section */}
                                {isLoadingProducts ? (
                                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                        <div className="animate-spin text-4xl mb-4">⌛</div>
                                        <p className="font-bold uppercase tracking-widest text-sm">Cargando catálogo...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {Object.entries(groupedProducts).map(([section, products]) => (
                                            <div key={section} className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                                                <button 
                                                    onClick={() => setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }))}
                                                    className="w-full px-6 py-4 flex justify-between items-center bg-gray-50/50 hover:bg-gray-100 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-8 rounded-full bg-primary-500" />
                                                        <h4 className="font-black text-gray-700 uppercase tracking-tight">{section}</h4>
                                                        <span className="bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                            {products.length}
                                                        </span>
                                                    </div>
                                                    <span className={`transition-transform duration-300 ${collapsedSections[section] ? 'rotate-180' : ''}`}>▼</span>
                                                </button>
                                                
                                                {!collapsedSections[section] && (
                                                    <div className="divide-y divide-gray-50">
                                                        {products.map((p) => (
                                                            <div key={p.IdProducto} className="px-6 py-3 flex items-center justify-between hover:bg-blue-50/30 transition-colors group">
                                                                <div className="flex-1 min-w-0 pr-4">
                                                                    <div className="text-sm font-bold text-gray-800 truncate">{p.Producto}</div>
                                                                    <div className="text-[10px] text-gray-400 flex items-center gap-2">
                                                                        <span className="font-mono">{p.Codigo}</span>
                                                                        <span>•</span>
                                                                        <span className="text-emerald-600 font-bold">
                                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.Precio)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="w-24">
                                                                    <input
                                                                        type="number"
                                                                        data-pos-input="true"
                                                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-center text-sm font-black text-gray-700 bg-gray-50/50 group-hover:bg-white"
                                                                        placeholder="0"
                                                                        min="0"
                                                                        value={manualQuantities[p.IdProducto] || ''}
                                                                        onChange={(e) => handleQuantityChange(p.IdProducto, e.target.value)}
                                                                        onKeyDown={handleKeyDown}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-white border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Reporte</span>
                            <span className="text-lg font-black text-emerald-600">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalFromPasted)}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Manual</span>
                            <span className="text-lg font-black text-primary-600">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalFromManual)}
                            </span>
                        </div>
                        <div className="flex flex-col border-l border-gray-200 pl-6">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Final</span>
                            <span className="text-2xl font-black text-gray-800">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalFromPasted + totalFromManual)}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose} className="rounded-2xl">Cancelar</Button>
                        <Button 
                            onClick={handleConfirmSave} 
                            disabled={isSaving || (parsedItems.length === 0 && totalFromManual === 0)}
                            className="px-10 py-3 rounded-2xl font-black shadow-xl disabled:opacity-50 active:scale-95 text-lg"
                            style={{ background: colors.colorFondo1, color: colors.colorLetra }}
                        >
                            {isSaving ? 'Guardando...' : '💾 Guardar Todo'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
