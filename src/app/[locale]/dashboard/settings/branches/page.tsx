'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import BranchEditModal from '@/components/BranchEditModal';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
    Telefonos: string | null;
    CorreoElectronico: string | null;
    Calle: string | null;
    IdEmpleadoGerente: number | null;
    GerenteNombre?: string | null;
    Status: number;
}

interface Employee {
    IdEmpleado: number;
    Empleado: string;
    Telefonos: string | null;
    CorreoElectronico: string | null;
}

export default function BranchesPage() {
    const t = useTranslations('Branches');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [formData, setFormData] = useState({
        branch: '',
        phone: '',
        email: '',
        address: '',
        managerId: '' as string | number
    });
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [project, setProject] = useState<any>(null);
    const [activeEditTab, setActiveEditTab] = useState('general');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchBranches();
            fetchEmployees();
        }
    }, [project]);

    const fetchEmployees = async () => {
        try {
            const response = await fetch(`/api/employees?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setEmployees(data.data);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    useEffect(() => {
        if (project?.idProyecto) {
            fetchBranches();
        }
    }, [project]);

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setBranches(data.data);
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingBranch({
            IdSucursal: 0,
            Sucursal: '',
            Telefonos: '',
            CorreoElectronico: '',
            Calle: '',
            IdEmpleadoGerente: null,
            Status: 0
        });
        setActiveEditTab('general');
        setIsEditModalOpen(true);
    };

    const handleDelete = async () => {
        if (!editingBranch) return;
        try {
            const response = await fetch(`/api/branches/${editingBranch.IdSucursal}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchBranches();
                setIsDeleteModalOpen(false);
                setEditingBranch(null);
            }
        } catch (error) {
            console.error('Error deleting branch:', error);
        }
    };

    const openEditModal = (branch: Branch) => {
        setEditingBranch(branch);
        setActiveEditTab('general');
        setIsEditModalOpen(true);
    };

    const openDeleteModal = (branch: Branch) => {
        setEditingBranch(branch);
        setIsDeleteModalOpen(true);
    };

    const openCostsModal = (branch: Branch) => {
        setEditingBranch(branch);
        setActiveEditTab('costs');
        setIsEditModalOpen(true);
    };

    const openInventoryModal = (branch: Branch) => {
        setEditingBranch(branch);
        setActiveEditTab('inventory');
        setIsEditModalOpen(true);
    };

    const openDocumentsModal = (branch: Branch) => {
        setEditingBranch(branch);
        setActiveEditTab('documents');
        setIsEditModalOpen(true);
    };

    const openShiftsModal = (branch: Branch) => {
        setEditingBranch(branch);
        setActiveEditTab('shifts');
        setIsEditModalOpen(true);
    };

    const openEmployeesModal = (branch: Branch) => {
        setEditingBranch(branch);
        setActiveEditTab('employees');
        setIsEditModalOpen(true);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Branch, direction: 'asc' | 'desc' } | null>(null);

    const sortedAndFilteredBranches = branches
        .filter(branch =>
            branch.Sucursal.toLowerCase().includes(searchTerm.toLowerCase()) ||
            branch.CorreoElectronico?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            const aVal = a[key] ?? '';
            const bVal = b[key] ?? '';
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof Branch) => {
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
                <Button onClick={openAddModal}>
                    {t('addBranch')}
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <ThemedGridHeader>
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('Sucursal')}
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                    {t('branchName')}
                                    {sortConfig?.key === 'Sucursal' && (
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
                            {t('phone')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('email')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell>
                            {t('active')}
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell className="text-right">
                            {t('actions')}
                        </ThemedGridHeaderCell>
                    </ThemedGridHeader>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredBranches.map((branch) => (
                            <tr key={branch.IdSucursal} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {branch.Sucursal}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {branch.Telefonos || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {branch.CorreoElectronico || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${branch.Status === 0
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {branch.Status === 0 ? t('active') : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => openEditModal(branch)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title={t('editBranch')}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => openDeleteModal(branch)}
                                        className="text-xl hover:scale-110 transition-transform"
                                        title={t('deleteBranch')}
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>


            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteBranch')}</h3>
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
                                {t('deleteBranch')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isEditModalOpen && editingBranch && (
                <BranchEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setEditingBranch(null);
                    }}
                    branch={editingBranch}
                    projectId={project?.idProyecto}
                    initialTab={activeEditTab}
                    onUpdate={fetchBranches}
                />
            )}
        </div>
    );
}
