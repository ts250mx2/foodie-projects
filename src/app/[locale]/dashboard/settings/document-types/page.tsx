'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import BaseModal from '@/components/BaseModal';
import PageShell from '@/components/PageShell';
import { FileText, Plus, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react';

interface DocumentType {
    IdTipoDocumento: number;
    TipoDocumento: string;
    Status: number;
}

export default function DocumentTypesPage() {
    const t = useTranslations('DocumentTypes');
    const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingDocumentType, setEditingDocumentType] = useState<DocumentType | null>(null);
    const [formData, setFormData] = useState({ documentType: '' });
    const [project, setProject] = useState<any>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchDocumentTypes();
        }
    }, [project]);

    const fetchDocumentTypes = async () => {
        try {
            const response = await fetch(`/api/document-types?projectId=${project.idProyecto}`);
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

    const handleSubmit = async () => {
        try {
            const url = editingDocumentType
                ? `/api/document-types/${editingDocumentType.IdTipoDocumento}`
                : '/api/document-types';

            const method = editingDocumentType ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    documentType: formData.documentType
                })
            });

            if (response.ok) {
                fetchDocumentTypes();
                setIsModalOpen(false);
                setFormData({ documentType: '' });
                setEditingDocumentType(null);
            }
        } catch (error) {
            console.error('Error saving document type:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingDocumentType) return;
        try {
            const response = await fetch(`/api/document-types/${editingDocumentType.IdTipoDocumento}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchDocumentTypes();
                setIsDeleteModalOpen(false);
                setEditingDocumentType(null);
            }
        } catch (error) {
            console.error('Error deleting document type:', error);
        }
    };

    const openEditModal = (documentType: DocumentType) => {
        setEditingDocumentType(documentType);
        setFormData({
            documentType: documentType.TipoDocumento
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (documentType: DocumentType) => {
        setEditingDocumentType(documentType);
        setIsDeleteModalOpen(true);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof DocumentType, direction: 'asc' | 'desc' } | null>(null);

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

    const handleSort = (key: keyof DocumentType) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <PageShell
            title={t('title')}
            icon={FileText}
            actions={
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative w-full sm:w-64">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ color: '#9ca3af' }}
                        />
                        <input
                            type="text"
                            placeholder="Buscar tipo de documento…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border bg-white focus:outline-none transition-all placeholder:text-gray-400 text-gray-700"
                            style={{
                                borderColor: '#e5e7eb',
                            }}
                        />
                    </div>
                    <Button
                        onClick={() => {
                            setEditingDocumentType(null);
                            setFormData({ documentType: '' });
                            setIsModalOpen(true);
                        }}
                        variant="solid"
                        leftIcon={Plus}
                        iconBox
                        size="sm"
                    >
                        {t('addDocumentType')}
                    </Button>
                </div>
            }
        >

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'TipoDocumento' ? sortConfig.direction : null}
                                onClick={() => handleSort('TipoDocumento')}
                            >
                                {t('documentTypeName')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>
                                {t('active')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">
                                {t('actions')}
                            </ThemedGridHeaderCell>
                        </ThemedGridHeader>
                        <TableBody
                            loading={false}
                            empty={sortedAndFilteredDocumentTypes.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Aún no hay tipos de documento. Agrega el primero.'}
                            colSpan={3}
                        >
                            {sortedAndFilteredDocumentTypes.map((docType) => (
                                <TableRow key={docType.IdTipoDocumento}>
                                    <TableCell>
                                        <span className="font-medium text-gray-900">{docType.TipoDocumento}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`badge ${docType.Status === 0 ? 'badge-green' : 'badge-red'}`}>
                                            {docType.Status === 0 ? t('active') : 'Inactivo'}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editDocumentType')}
                                                variant="edit"
                                                onClick={() => openEditModal(docType)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deleteDocumentType')}
                                                variant="delete"
                                                onClick={() => openDeleteModal(docType)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                </div>
            </div>

            {/* Edit/Create Modal */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingDocumentType ? t('editDocumentType') : t('addDocumentType')}
                subtitle={editingDocumentType ? `Editando: ${editingDocumentType.TipoDocumento}` : 'Completa la información del tipo de documento'}
                size="lg"
                onConfirm={handleSubmit}
                confirmLabel={t('save')}
                cancelLabel={t('cancel')}
                headerVariant="primary"
            >
                <div className="space-y-4">
                    <Input
                        label={t('documentTypeName')}
                        value={formData.documentType}
                        onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                        required
                    />
                </div>
            </BaseModal>

            {/* Delete Confirmation Modal */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar tipo de documento"
                size="sm"
                onConfirm={handleDelete}
                confirmLabel="Sí, eliminar"
                cancelLabel={t('cancel')}
            >
                <div className="flex flex-col items-center gap-4 py-2 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertTriangle size={24} className="text-red-500" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-800">¿Eliminar {editingDocumentType?.TipoDocumento}?</p>
                        <p className="text-sm text-gray-500 mt-1">{t('confirmDelete')}</p>
                    </div>
                </div>
            </BaseModal>
        </PageShell>
    );
}
