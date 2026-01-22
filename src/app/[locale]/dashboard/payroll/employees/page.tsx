'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ScheduleTimelineModal from '@/components/ScheduleTimelineModal';
import EmployeeDocumentsModal from '@/components/EmployeeDocumentsModal';
import EmployeeAccessModal from '@/components/EmployeeAccessModal';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';

interface Employee {
    IdEmpleado: number;
    Empleado: string;
    IdPuesto: number | null;
    Puesto: string | null;
    IdSucursal: number | null;
    Sucursal: string | null;
    Telefonos: string | null;
    CorreoElectronico: string | null;
    Calle: string | null;
    Status: number;
}

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface Position {
    IdPuesto: number;
    Puesto: string;
}

export default function EmployeesPage() {
    const t = useTranslations('Employees');
    const tSchedules = useTranslations('SchedulesModal');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        positionId: '',
        branchId: '',
        phone: '',
        email: '',
        address: ''
    });
    const [project, setProject] = useState<any>(null);

    // Schedule modal state
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [selectedBranchForCapture, setSelectedBranchForCapture] = useState<string>('');
    const [selectedEmployeeForCapture, setSelectedEmployeeForCapture] = useState<number | undefined>(undefined);
    const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
    const [selectedEmployeeForDocuments, setSelectedEmployeeForDocuments] = useState<Employee | null>(null);
    const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
    const [selectedEmployeeForAccess, setSelectedEmployeeForAccess] = useState<Employee | null>(null);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchEmployees();
            fetchPositions();
            fetchBranches();
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
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPositions = async () => {
        try {
            const response = await fetch(`/api/positions?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setPositions(data.data);
            }
        } catch (error) {
            console.error('Error fetching positions:', error);
        }
    };

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setBranches(data.data);
                if (data.data.length > 0) {
                    setSelectedBranchForCapture(data.data[0].IdSucursal.toString());
                }
            }
        } catch (error) {
            console.error('Error fetching positions:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingEmployee
                ? `/api/employees/${editingEmployee.IdEmpleado}`
                : '/api/employees';

            const method = editingEmployee ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    name: formData.name,
                    positionId: formData.positionId ? parseInt(formData.positionId) : null,
                    branchId: formData.branchId ? parseInt(formData.branchId) : null,
                    phone: formData.phone,
                    email: formData.email,
                    address: formData.address
                })
            });

            if (response.ok) {
                fetchEmployees();
                setIsModalOpen(false);
                setFormData({ name: '', positionId: '', branchId: '', phone: '', email: '', address: '' });
                setEditingEmployee(null);
            }
        } catch (error) {
            console.error('Error saving employee:', error);
        }
    };

    const handleDelete = async () => {
        if (!editingEmployee) return;
        try {
            const response = await fetch(`/api/employees/${editingEmployee.IdEmpleado}?projectId=${project.idProyecto}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchEmployees();
                setIsDeleteModalOpen(false);
                setEditingEmployee(null);
            }
        } catch (error) {
            console.error('Error deleting employee:', error);
        }
    };

    const openEditModal = (employee: Employee) => {
        setEditingEmployee(employee);
        setFormData({
            name: employee.Empleado,
            positionId: employee.IdPuesto?.toString() || '',
            branchId: employee.IdSucursal?.toString() || '',
            phone: employee.Telefonos || '',
            email: employee.CorreoElectronico || '',
            address: employee.Calle || ''
        });
        setIsModalOpen(true);
    };

    const openDeleteModal = (employee: Employee) => {
        setEditingEmployee(employee);
        setIsDeleteModalOpen(true);
    };

    const openDocumentsModal = (employee: Employee) => {
        setSelectedEmployeeForDocuments(employee);
        setIsDocumentsModalOpen(true);
    };

    const openAccessModal = (employee: Employee) => {
        setSelectedEmployeeForAccess(employee);
        setIsAccessModalOpen(true);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Employee, direction: 'asc' | 'desc' } | null>(null);

    const sortedAndFilteredEmployees = employees
        .filter(employee =>
            employee.Empleado.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.Puesto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.Sucursal?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.CorreoElectronico?.toLowerCase().includes(searchTerm.toLowerCase())
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

    const handleSort = (key: keyof Employee) => {
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
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setSelectedEmployeeForCapture(undefined);
                            setIsScheduleModalOpen(true);
                        }}
                    >
                        🗓️ {tSchedules('title')}
                    </Button>
                    <Button onClick={() => {
                        setEditingEmployee(null);
                        setFormData({ name: '', positionId: '', branchId: '', phone: '', email: '', address: '' });
                        setIsModalOpen(true);
                    }}>
                        {t('addEmployee')}
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <ThemedGridHeader>
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('Empleado')}
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                    {t('employeeName')}
                                    {sortConfig?.key === 'Empleado' && (
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
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('Puesto')}
                        >
                            <div className="flex items-center gap-1">
                                {t('position')}
                                {sortConfig?.key === 'Puesto' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </div>
                        </ThemedGridHeaderCell>
                        <ThemedGridHeaderCell
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => handleSort('Sucursal')}
                        >
                            <div className="flex items-center gap-1">
                                {t('branch')}
                                {sortConfig?.key === 'Sucursal' && (
                                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                )}
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
                        {sortedAndFilteredEmployees.map((employee) => (
                            <tr key={employee.IdEmpleado} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {employee.Empleado}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {employee.Puesto || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {employee.Sucursal || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {employee.Telefonos || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {employee.CorreoElectronico || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${employee.Status === 0
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}>
                                        {employee.Status === 0 ? t('active') : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => {
                                            if (employee.IdSucursal) {
                                                setSelectedBranchForCapture(employee.IdSucursal.toString());
                                            }
                                            setSelectedEmployeeForCapture(employee.IdEmpleado);
                                            setIsScheduleModalOpen(true);
                                        }}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title={tSchedules('title')}
                                    >
                                        🗓️
                                    </button>
                                    <button
                                        onClick={() => openAccessModal(employee)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title="Acceso"
                                    >
                                        🔑
                                    </button>
                                    <button
                                        onClick={() => openEditModal(employee)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title={t('editEmployee')}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => openDocumentsModal(employee)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title="Documentos"
                                    >
                                        📄
                                    </button>
                                    <button
                                        onClick={() => openDeleteModal(employee)}
                                        className="text-xl hover:scale-110 transition-transform"
                                        title={t('deleteEmployee')}
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
                            {editingEmployee ? t('editEmployee') : t('addEmployee')}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label={t('employeeName')}
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('position')}
                                </label>
                                <select
                                    value={formData.positionId}
                                    onChange={(e) => setFormData({ ...formData, positionId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value="">{t('selectPosition')}</option>
                                    {positions.map((position) => (
                                        <option key={position.IdPuesto} value={position.IdPuesto}>
                                            {position.Puesto}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('branch')}
                                </label>
                                <select
                                    value={formData.branchId}
                                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value="">{t('selectBranch')}</option>
                                    {branches.map((branch) => (
                                        <option key={branch.IdSucursal} value={branch.IdSucursal}>
                                            {branch.Sucursal}
                                        </option>
                                    ))}
                                </select>
                            </div>

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
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteEmployee')}</h3>
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
                                {t('deleteEmployee')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Schedule Capture Modal */}
            {project && (
                <ScheduleTimelineModal
                    isOpen={isScheduleModalOpen}
                    onClose={() => setIsScheduleModalOpen(false)}
                    employeeId={selectedEmployeeForCapture}
                    projectId={project.idProyecto}
                    branchId={selectedBranchForCapture}
                    onSaveSuccess={() => { }} // No refresh needed on this page unless we show schedules here
                />
            )}

            {selectedEmployeeForDocuments && (
                <EmployeeDocumentsModal
                    isOpen={isDocumentsModalOpen}
                    onClose={() => setIsDocumentsModalOpen(false)}
                    employeeId={selectedEmployeeForDocuments.IdEmpleado}
                    employeeName={selectedEmployeeForDocuments.Empleado}
                    projectId={project?.idProyecto}
                />
            )}

            {selectedEmployeeForAccess && (
                <EmployeeAccessModal
                    isOpen={isAccessModalOpen}
                    onClose={() => setIsAccessModalOpen(false)}
                    employeeId={selectedEmployeeForAccess.IdEmpleado}
                    employeeName={selectedEmployeeForAccess.Empleado}
                    projectId={project?.idProyecto}
                />
            )}
        </div>
    );
}
