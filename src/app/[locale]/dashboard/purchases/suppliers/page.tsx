'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';

interface Supplier {
    IdProveedor: number;
    Proveedor: string;
    RFC: string;
    Telefonos: string;
    CorreoElectronico: string;
    Calle: string;
    Contacto: string;
    Status: number;
}

export default function SuppliersPage() {
    const t = useTranslations('Suppliers');
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [formData, setFormData] = useState({
        proveedor: '',
        rfc: '',
        telefonos: '',
        correoElectronico: '',
        calle: '',
        contacto: ''
    });
    const [project, setProject] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Supplier, direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchSuppliers();
        }
    }, [project]);

    const fetchSuppliers = async () => {
        try {
            const response = await fetch(`/api/suppliers?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setSuppliers(data.data);
            }
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingSupplier
                ? `/api/suppliers/${editingSupplier.IdProveedor}`
                : '/api/suppliers';

            const method = editingSupplier ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    ...formData
                })
            });

            if (response.ok) {
                fetchSuppliers();
                setIsModalOpen(false);
                setFormData({
                    proveedor: '',
                    rfc: '',
                    telefonos: '',
                    correoElectronico: '',
                    calle: '',
                    contacto: ''
                });
                setEditingSupplier(null);
            }
        } catch (error) {
            console.error('Error saving supplier:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingSupplier) return;
        try {
            const response = await fetch(`/api/suppliers/${editingSupplier.IdProveedor}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchSuppliers();
                setIsDeleteModalOpen(false);
                setEditingSupplier(null);
            }
        } catch (error) {
            console.error('Error deleting supplier:', error);
        }
    };

    const openEditModal = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setFormData({
            proveedor: supplier.Proveedor,
            rfc: supplier.RFC,
            telefonos: supplier.Telefonos,
            correoElectronico: supplier.CorreoElectronico,
            calle: supplier.Calle,
            contacto: supplier.Contacto
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setIsDeleteModalOpen(true);
    };

    const sortedAndFilteredSuppliers = suppliers
        .filter(supplier =>
            supplier.Proveedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
            supplier.RFC.toLowerCase().includes(searchTerm.toLowerCase()) ||
            supplier.Contacto.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            const aVal = a[key];
            const bVal = b[key];
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return direction === 'asc' ? 1 : -1;
            if (bVal == null) return direction === 'asc' ? -1 : 1;
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof Supplier) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{t('title')}</h1>
                <Button onClick={() => {
                    setEditingSupplier(null);
                    setFormData({
                        proveedor: '',
                        rfc: '',
                        telefonos: '',
                        correoElectronico: '',
                        calle: '',
                        contacto: ''
                    });
                    setIsModalOpen(true);
                }}>
                    {t('addSupplier')}
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <ThemedGridHeader>
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('Proveedor')}
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                    {t('supplierName')}
                                    {sortConfig?.key === 'Proveedor' && (
                                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    placeholder="🔍 Filter..."
                                    className="mt-1 px-2 py-1 text-xs border border-gray-300 rounded font-normal text-gray-700"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            RFC
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('phones')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('email')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('contact')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('active')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">
                            {t('actions')}
                        </ThemedGridHeaderCell>
                    </ThemedGridHeader>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredSuppliers.map((supplier) => (
                            <tr key={supplier.IdProveedor} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {supplier.Proveedor}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {supplier.RFC}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {supplier.Telefonos}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {supplier.CorreoElectronico}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {supplier.Contacto}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${supplier.Status === 0
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {supplier.Status === 0 ? t('active') : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => openEditModal(supplier)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title={t('editSupplier')}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => openDeleteModal(supplier)}
                                        className="text-xl hover:scale-110 transition-transform"
                                        title={t('deleteSupplier')}
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit/Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
                        <h2 className="text-xl font-bold mb-4">
                            {editingSupplier ? t('editSupplier') : t('addSupplier')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label={t('supplierName')}
                                value={formData.proveedor}
                                onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                                required
                            />
                            <Input
                                label="RFC"
                                value={formData.rfc}
                                onChange={(e) => setFormData({ ...formData, rfc: e.target.value })}
                            />
                            <Input
                                label={t('phones')}
                                value={formData.telefonos}
                                onChange={(e) => setFormData({ ...formData, telefonos: e.target.value })}
                            />
                            <Input
                                label={t('email')}
                                type="email"
                                value={formData.correoElectronico}
                                onChange={(e) => setFormData({ ...formData, correoElectronico: e.target.value })}
                            />
                            <Input
                                label={t('address')}
                                value={formData.calle}
                                onChange={(e) => setFormData({ ...formData, calle: e.target.value })}
                            />
                            <Input
                                label={t('contact')}
                                value={formData.contacto}
                                onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-white bg-orange-500 rounded hover:bg-orange-600"
                                >
                                    {t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{t('deleteSupplier')}</h2>
                        <p className="mb-6">{t('confirmDelete')}</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 text-white bg-red-500 rounded hover:bg-red-600"
                            >
                                {t('deleteSupplier')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
