'use client';

import { useState } from 'react';

export interface SearchProduct {
    IdProducto: number;
    Producto: string;
    Codigo: string;
    Categoria?: string;
    Presentacion?: string;
    Precio: number;
    //Add other fields if necessary
}

interface ProductSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (product: SearchProduct) => void;
    products: SearchProduct[];
    title?: string;
}

export default function ProductSearchModal({
    isOpen,
    onClose,
    onSelect,
    products,
    title = 'Seleccionar Producto'
}: ProductSearchModalProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProducts = products.filter(p =>
        searchTerm === '' ||
        p.Producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.Codigo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="bg-blue-500 text-white px-6 py-4 flex justify-between items-center">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white/20 rounded-full p-2"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-4 border-b">
                    <input
                        type="text"
                        placeholder="🔍 Buscar por código o producto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        autoFocus
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">Código</th>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">Producto</th>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">Categoría</th>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">Presentación</th>
                                <th className="px-4 py-2 text-center text-xs font-bold text-gray-600">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredProducts.map(p => (
                                <tr key={p.IdProducto} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm">{p.Codigo}</td>
                                    <td className="px-4 py-2 text-sm">{p.Producto}</td>
                                    <td className="px-4 py-2 text-sm">{p.Categoria || '-'}</td>
                                    <td className="px-4 py-2 text-sm">{p.Presentacion || '-'}</td>
                                    <td className="px-4 py-2 text-center">
                                        <button
                                            onClick={() => {
                                                onSelect(p);
                                                setSearchTerm(''); // Reset search on select
                                            }}
                                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                                        >
                                            ➕ Agregar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                        No se encontraron productos
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
