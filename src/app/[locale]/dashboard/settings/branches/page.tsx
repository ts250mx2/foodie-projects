'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import BranchCostsModal from '@/components/BranchCostsModal';
import BranchInventoryDatesModal from '@/components/BranchInventoryDatesModal';
import BranchDocumentsModal from '@/components/BranchDocumentsModal';
import BranchShiftsModal from '@/components/BranchShiftsModal';
import BranchEmployeesModal from '@/components/BranchEmployeesModal';
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
    const [isModalOpen, setIsModalOpen] = useState(false);
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
    const [isCostsModalOpen, setIsCostsModalOpen] = useState(false);
    const [selectedBranchForCosts, setSelectedBranchForCosts] = useState<Branch | null>(null);
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
    const [selectedBranchForInventory, setSelectedBranchForInventory] = useState<Branch | null>(null);
    const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
    const [selectedBranchForDocuments, setSelectedBranchForDocuments] = useState<Branch | null>(null);
    const [isShiftsModalOpen, setIsShiftsModalOpen] = useState(false);
    const [selectedBranchForShifts, setSelectedBranchForShifts] = useState<Branch | null>(null);
    const [isEmployeesModalOpen, setIsEmployeesModalOpen] = useState(false);
    const [selectedBranchForEmployees, setSelectedBranchForEmployees] = useState<Branch | null>(null);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingBranch
                ? `/api/branches/${editingBranch.IdSucursal}`
                : '/api/branches';

            const method = editingBranch ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    branch: formData.branch,
                    phone: formData.phone,
                    email: formData.email,
                    address: formData.address,
                    managerId: formData.managerId || null
                })
            });

            if (response.ok) {
                fetchBranches();
                setIsModalOpen(false);
                setFormData({ branch: '', phone: '', email: '', address: '', managerId: '' });
                setEditingBranch(null);
            }
        } catch (error) {
            console.error('Error saving branch:', error);
        }
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
        setFormData({
            branch: branch.Sucursal,
            phone: branch.Telefonos || '',
            email: branch.CorreoElectronico || '',
            address: branch.Calle || '',
            managerId: branch.IdEmpleadoGerente || ''
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (branch: Branch) => {
        setEditingBranch(branch);
        setIsDeleteModalOpen(true);
    };

    const openCostsModal = (branch: Branch) => {
        setSelectedBranchForCosts(branch);
        setIsCostsModalOpen(true);
    };

    const openInventoryModal = (branch: Branch) => {
        setSelectedBranchForInventory(branch);
        setIsInventoryModalOpen(true);
    };

    const openDocumentsModal = (branch: Branch) => {
        setSelectedBranchForDocuments(branch);
        setIsDocumentsModalOpen(true);
    };

    const openShiftsModal = (branch: Branch) => {
        setSelectedBranchForShifts(branch);
        setIsShiftsModalOpen(true);
    };

    const openEmployeesModal = (branch: Branch) => {
        setSelectedBranchForEmployees(branch);
        setIsEmployeesModalOpen(true);
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
                <Button onClick={() => {
                    setEditingBranch(null);
                    setFormData({ branch: '', phone: '', email: '', address: '', managerId: '' });
                    setIsModalOpen(true);
                }}>
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
                                        onClick={() => openCostsModal(branch)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title="Objetivos y Costos"
                                    >
                                        🎯
                                    </button>
                                    <button
                                        onClick={() => openInventoryModal(branch)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title="Fechas de Inventario"
                                    >
                                        📋
                                    </button>
                                    <button
                                        onClick={() => openDocumentsModal(branch)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title="Documentos"
                                    >
                                        📄
                                    </button>
                                    <button
                                        onClick={() => openShiftsModal(branch)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title="Turnos"
                                    >
                                        ⏰
                                    </button>
                                    <button
                                        onClick={() => openEmployeesModal(branch)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title="Empleados con Acceso"
                                    >
                                        👥
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

            {/* Edit/Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">
                            {editingBranch ? t('editBranch') : t('addBranch')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label={t('branchName')}
                                value={formData.branch}
                                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                                required
                            />

                            <Input
                                label={t('phone')}
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                type="tel"
                            />

                            <Input
                                label={t('email')}
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                type="email"
                            />

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('address')}
                                </label>
                                <textarea
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    rows={3}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 p-4 bg-orange-50 rounded-lg border border-orange-100">
                                <h3 className="text-sm font-bold text-orange-800 uppercase tracking-tight">Gerente de Sucursal</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar Gerente</label>
                                    <select
                                        value={formData.managerId}
                                        onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                    >
                                        <option value="">-- Sin Gerente --</option>
                                        {employees.map(emp => (
                                            <option key={emp.IdEmpleado} value={emp.IdEmpleado}>
                                                {emp.Empleado}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {formData.managerId && (
                                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="bg-white p-2 rounded border border-orange-200">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Teléfono</p>
                                            <p className="text-sm font-medium text-gray-900">
                                                {employees.find(e => e.IdEmpleado == formData.managerId)?.Telefonos || '-'}
                                            </p>
                                        </div>
                                        <div className="bg-white p-2 rounded border border-orange-200 overflow-hidden">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Correo</p>
                                            <p className="text-sm font-medium text-gray-900 truncate" title={employees.find(e => e.IdEmpleado == formData.managerId)?.CorreoElectronico || ''}>
                                                {employees.find(e => e.IdEmpleado == formData.managerId)?.CorreoElectronico || '-'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
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

            {selectedBranchForCosts && (
                <BranchCostsModal
                    isOpen={isCostsModalOpen}
                    onClose={() => setIsCostsModalOpen(false)}
                    branchId={selectedBranchForCosts.IdSucursal}
                    branchName={selectedBranchForCosts.Sucursal}
                    projectId={project?.idProyecto}
                />
            )}

            {selectedBranchForInventory && (
                <BranchInventoryDatesModal
                    isOpen={isInventoryModalOpen}
                    onClose={() => setIsInventoryModalOpen(false)}
                    branchId={selectedBranchForInventory.IdSucursal}
                    branchName={selectedBranchForInventory.Sucursal}
                    projectId={project?.idProyecto}
                />
            )}

            {selectedBranchForDocuments && (
                <BranchDocumentsModal
                    isOpen={isDocumentsModalOpen}
                    onClose={() => setIsDocumentsModalOpen(false)}
                    branchId={selectedBranchForDocuments.IdSucursal}
                    branchName={selectedBranchForDocuments.Sucursal}
                    projectId={project?.idProyecto}
                />
            )}

            {selectedBranchForShifts && (
                <BranchShiftsModal
                    isOpen={isShiftsModalOpen}
                    onClose={() => setIsShiftsModalOpen(false)}
                    branchId={selectedBranchForShifts.IdSucursal.toString()}
                    branchName={selectedBranchForShifts.Sucursal}
                    projectId={project?.idProyecto}
                />
            )}

            {selectedBranchForEmployees && (
                <BranchEmployeesModal
                    isOpen={isEmployeesModalOpen}
                    onClose={() => setIsEmployeesModalOpen(false)}
                    branchId={selectedBranchForEmployees.IdSucursal}
                    branchName={selectedBranchForEmployees.Sucursal}
                    projectId={project?.idProyecto}
                />
            )}
        </div>
    );
}
