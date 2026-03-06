'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';

interface DocumentType {
    IdTipoDocumento: number;
    TipoDocumento: string;
    Status: number;
}

interface DocumentTypesModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
}

export default function DocumentTypesModal({ isOpen, onClose, projectId }: DocumentTypesModalProps) {
    const t = useTranslations('DocumentTypes');
    const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isInternalModalOpen, setIsInternalModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingDocumentType, setEditingDocumentType] = useState<DocumentType | null>(null);
    const [formData, setFormData] = useState({ documentType: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof DocumentType, direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        if (isOpen && projectId) {
            fetchDocumentTypes();
        }
    }, [isOpen, projectId]);

    const fetchDocumentTypes = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/document-types?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setDocumentTypes(data.data);
            }
        } catch (error) {
            console.error('Error fetching document types:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingDocumentType
                ? `/api/document-types/${editingDocumentType.IdTipoDocumento}`
                : '/api/document-types';

            const method = editingDocumentType ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    documentType: formData.documentType
                })
            });

            if (response.ok) {
                fetchDocumentTypes();
                setIsInternalModalOpen(false);
                setFormData({ documentType: '' });
                setEditingDocumentType(null);
            } else {
                const data = await response.json();
                alert(data.message || 'Error al guardar el tipo de documento');
            }
        } catch (error) {
            console.error('Error saving document type:', error);
            alert('Error de conexión al guardar el tipo de documento');
        }
    };

    const handleDelete = async () => {
        if (!editingDocumentType) return;
        try {
            const response = await fetch(`/api/document-types/${editingDocumentType.IdTipoDocumento}?projectId=${projectId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchDocumentTypes();
                setIsDeleteModalOpen(false);
                setEditingDocumentType(null);
            } else {
                const data = await response.json();
                alert(data.message || 'Error al eliminar el tipo de documento');
            }
        } catch (error) {
            console.error('Error deleting document type:', error);
            alert('Error de conexión al eliminar el tipo de documento');
        }
    };

    const openEditModal = (documentType: DocumentType) => {
        setEditingDocumentType(documentType);
        setFormData({
            documentType: documentType.TipoDocumento
        });
        setIsInternalModalOpen(true);
    };

    const openDeleteModal = (documentType: DocumentType) => {
        setEditingDocumentType(documentType);
        setIsDeleteModalOpen(true);
    };

    const handleSort = (key: keyof DocumentType) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredDocumentTypes = documentTypes
        .filter(docType =>
            docType.TipoDocumento.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] flex flex-col relative shadow-2xl border border-gray-100">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <span className="text-2xl">✕</span>
                </button>

                <div className="flex justify-between items-center mb-6 pr-8">
                    <h1 className="text-2xl font-bold text-gray-800">{t('title')}</h1>
                    <Button onClick={() => {
                        setEditingDocumentType(null);
                        setFormData({ documentType: '' });
                        setIsInternalModalOpen(true);
                    }}>
                        {t('addDocumentType')}
                    </Button>
                </div>

                <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="overflow-y-auto flex-1">
                        <table className="min-w-full divide-y divide-gray-200">
                            <ThemedGridHeader>
                                <ThemedGridHeaderCell
                                    className="cursor-pointer hover:opacity-80"
                                    onClick={() => handleSort('TipoDocumento')}
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1">
                                            {t('documentTypeName')}
                                            {sortConfig?.key === 'TipoDocumento' && (
                                                <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="🔍 Filter..."
                                            className="mt-1 px-2 py-1 text-xs border border-gray-300 rounded font-normal text-gray-700 w-full"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>
                                    {t('active')}
                                </ThemedGridHeaderCell>
                                <ThemedGridHeaderCell className="text-right">
                                    {t('actions')}
                                </ThemedGridHeaderCell>
                            </ThemedGridHeader>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-10 text-center text-gray-500 italic">
                                            Cargando tipos de documentos...
                                        </td>
                                    </tr>
                                ) : sortedAndFilteredDocumentTypes.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-10 text-center text-gray-500 italic">
                                            No se encontraron tipos de documentos.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedAndFilteredDocumentTypes.map((docType) => (
                                        <tr key={docType.IdTipoDocumento} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {docType.TipoDocumento}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${docType.Status === 0
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {docType.Status === 0 ? t('active') : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => openEditModal(docType)}
                                                    className="text-xl mr-4 hover:scale-110 transition-transform"
                                                    title={t('editDocumentType')}
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => openDeleteModal(docType)}
                                                    className="text-xl hover:scale-110 transition-transform"
                                                    title={t('deleteDocumentType')}
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-end mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
                    >
                        Cerrar
                    </button>
                </div>

                {/* Edit/Create Modal (Internal) */}
                {isInternalModalOpen && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]">
                        <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl">
                            <h2 className="text-xl font-bold mb-4">
                                {editingDocumentType ? t('editDocumentType') : t('addDocumentType')}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label={t('documentTypeName')}
                                    value={formData.documentType}
                                    onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                                    required
                                    autoFocus
                                />
                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsInternalModalOpen(false)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                                    >
                                        {t('cancel')}
                                    </button>
                                    <Button type="submit">
                                        {t('save')}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal (Internal) */}
                {isDeleteModalOpen && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]">
                        <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-2xl">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteDocumentType')}</h3>
                            <p className="text-gray-500 mb-6">{t('confirmDelete')}</p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                                >
                                    {t('deleteDocumentType')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
