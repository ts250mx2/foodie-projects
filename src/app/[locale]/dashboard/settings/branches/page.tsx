'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import BranchEditModal from '@/components/BranchEditModal';
import BaseModal from '@/components/BaseModal';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import PageShell from '@/components/PageShell';
import { MapPin, Search, Pencil, Trash2, Phone, Mail, AlertTriangle, Plus } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

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

function branchInitials(name: string) {
    return name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();
}

const AVATAR_COLORS = [
    'bg-violet-100 text-violet-700',
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
];

function avatarColor(id: number) {
    return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export default function BranchesPage() {
    const t = useTranslations('Branches');
    const { colors } = useTheme();
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
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Branch, direction: 'asc' | 'desc' } | null>(null);

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
        <PageShell title={t('title')} icon={MapPin} actions={
            <div className="flex gap-2 items-center flex-wrap">
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg flex-1 min-w-[200px] max-w-xs">
                    <Search size={18} className="text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('search') || 'Search...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent"
                    />
                </div>
                <Button
                    variant="solid"
                    leftIcon={Plus}
                    iconBox
                    size="sm"
                    onClick={openAddModal}
                >
                    {t('addBranch')}
                </Button>
            </div>
        }>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Sucursal' ? sortConfig.direction : null}
                                onClick={() => handleSort('Sucursal')}
                            >
                                {t('branchName')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Telefonos' ? sortConfig.direction : null}
                                onClick={() => handleSort('Telefonos')}
                            >
                                {t('phone')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'CorreoElectronico' ? sortConfig.direction : null}
                                onClick={() => handleSort('CorreoElectronico')}
                            >
                                {t('email')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>
                                {t('active')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">
                                {t('actions')}
                            </ThemedGridHeaderCell>
                        </ThemedGridHeader>
                        <TableBody
                            loading={isLoading}
                            empty={sortedAndFilteredBranches.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Aún no hay sucursales. Agrega la primera.'}
                            colSpan={5}
                        >
                            {sortedAndFilteredBranches.map((branch) => (
                                <TableRow key={branch.IdSucursal}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${avatarColor(branch.IdSucursal)}`}>
                                                {branchInitials(branch.Sucursal)}
                                            </div>
                                            <span className="font-medium text-gray-900">{branch.Sucursal}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell muted>
                                        {branch.Telefonos ? (
                                            <div className="flex items-center gap-2">
                                                <Phone size={16} className="text-gray-400" />
                                                <span>{branch.Telefonos}</span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell muted>
                                        {branch.CorreoElectronico ? (
                                            <div className="flex items-center gap-2">
                                                <Mail size={16} className="text-gray-400" />
                                                <span>{branch.CorreoElectronico}</span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${branch.Status === 0
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {branch.Status === 0 ? t('active') : 'Inactive'}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editBranch')}
                                                variant="edit"
                                                onClick={() => openEditModal(branch)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deleteBranch')}
                                                variant="delete"
                                                onClick={() => openDeleteModal(branch)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title={t('deleteBranch')}
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
                        <p className="font-semibold text-gray-800">¿Eliminar {editingBranch?.Sucursal}?</p>
                        <p className="text-sm text-gray-500 mt-1">{t('confirmDelete')}</p>
                    </div>
                </div>
            </BaseModal>

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
        </PageShell>
    );
}
