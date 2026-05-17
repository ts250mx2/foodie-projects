'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
    Truck, Plus, Search, Pencil, Trash2,
    Phone, Mail, User, AlertTriangle,
} from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import PageShell from '@/components/PageShell';
import BaseModal from '@/components/BaseModal';
import ThemedGridHeader, {
    ThemedGridHeaderCell,
    TableBody,
    TableRow,
    TableCell,
    RowActionButton,
} from '@/components/ThemedGridHeader';
import { useToast } from '@/contexts/ToastContext';

interface Supplier {
    IdProveedor: number;
    Proveedor: string;
    RFC: string;
    Telefonos: string;
    CorreoElectronico: string;
    Calle: string;
    Contacto: string;
    EsProveedorGasto: number;
    Status: number;
}

const EMPTY_FORM = {
    proveedor: '',
    rfc: '',
    telefonos: '',
    correoElectronico: '',
    calle: '',
    contacto: '',
    esProveedorGasto: false,
};

function supplierInitials(name: string) {
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

export default function SuppliersPage() {
    const t = useTranslations('Suppliers');
    const { success, error: toastError } = useToast();

    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const [project, setProject] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'gasto' | 'compra'>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Supplier; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('project');
        if (stored) setProject(JSON.parse(stored));
    }, []);

    useEffect(() => {
        if (project?.idProyecto) fetchSuppliers();
    }, [project]);

    const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/suppliers?projectId=${project.idProyecto}`);
            const data = await res.json();
            if (data.success) setSuppliers(data.data);
        } catch {
            toastError('Error al cargar proveedores');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.proveedor.trim()) return;
        setIsSaving(true);
        try {
            const url = editingSupplier
                ? `/api/suppliers/${editingSupplier.IdProveedor}`
                : '/api/suppliers';
            const res = await fetch(url, {
                method: editingSupplier ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: project.idProyecto, ...formData }),
            });
            const data = await res.json();
            if (data.success) {
                await fetchSuppliers();
                setIsModalOpen(false);
                setEditingSupplier(null);
                setFormData(EMPTY_FORM);
                success(editingSupplier ? 'Proveedor actualizado' : 'Proveedor creado');
            } else {
                toastError(data.message || 'Error al guardar');
            }
        } catch {
            toastError('Error de conexión');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editingSupplier) return;
        setIsDeleting(true);
        try {
            const res = await fetch(
                `/api/suppliers/${editingSupplier.IdProveedor}?projectId=${project.idProyecto}`,
                { method: 'DELETE' }
            );
            if (res.ok) {
                await fetchSuppliers();
                setIsDeleteModalOpen(false);
                setEditingSupplier(null);
                success('Proveedor eliminado');
            }
        } catch {
            toastError('Error al eliminar');
        } finally {
            setIsDeleting(false);
        }
    };

    const openEdit = (s: Supplier) => {
        setEditingSupplier(s);
        setFormData({
            proveedor: s.Proveedor,
            rfc: s.RFC,
            telefonos: s.Telefonos,
            correoElectronico: s.CorreoElectronico,
            calle: s.Calle,
            contacto: s.Contacto,
            esProveedorGasto: s.EsProveedorGasto === 1,
        });
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditingSupplier(null);
        setFormData(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const handleSort = (key: keyof Supplier) => {
        setSortConfig((prev) =>
            prev?.key === key
                ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { key, direction: 'asc' }
        );
    };

    const filtered = suppliers
        .filter((s) => {
            const term = searchTerm.toLowerCase();
            const matchSearch =
                !term ||
                s.Proveedor.toLowerCase().includes(term) ||
                s.RFC.toLowerCase().includes(term) ||
                s.Contacto.toLowerCase().includes(term) ||
                s.CorreoElectronico.toLowerCase().includes(term);
            const matchType =
                typeFilter === 'all' ||
                (typeFilter === 'gasto' && s.EsProveedorGasto === 1) ||
                (typeFilter === 'compra' && s.EsProveedorGasto !== 1);
            return matchSearch && matchType;
        })
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            const av = a[key] ?? '';
            const bv = b[key] ?? '';
            if (av < bv) return direction === 'asc' ? -1 : 1;
            if (av > bv) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    return (
        <PageShell
            title={t('title')}
            subtitle={`${suppliers.length} proveedores registrados`}
            icon={Truck}
            actions={
                <Button leftIcon={Plus} iconBox onClick={openNew} size="md" variant="solid">
                    {t('addSupplier')}
                </Button>
            }
        >
            {/* ── Toolbar ─────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, RFC o contacto…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 transition-all placeholder:text-gray-400"
                    />
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg">
                    {(['all', 'compra', 'gasto'] as const).map((f) => {
                        const labels = { all: 'Todos', compra: 'Compra', gasto: 'Gasto' };
                        return (
                            <button
                                key={f}
                                onClick={() => setTypeFilter(f)}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${typeFilter === f
                                    ? 'bg-white text-gray-800 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {labels[f]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Table ───────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Proveedor' ? sortConfig.direction : null}
                                onClick={() => handleSort('Proveedor')}
                            >
                                {t('supplierName')}
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'RFC' ? sortConfig.direction : null}
                                onClick={() => handleSort('RFC')}
                            >
                                RFC
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>{t('contact')}</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>{t('phones')}</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>{t('email')}</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="center">Tipo</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="center">Estatus</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">{t('actions')}</ThemedGridHeaderCell>
                        </ThemedGridHeader>

                        <TableBody
                            loading={isLoading}
                            empty={!isLoading && filtered.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Aún no hay proveedores. Agrega el primero.'}
                            colSpan={8}
                        >
                            {filtered.map((s) => (
                                <TableRow key={s.IdProveedor}>
                                    {/* Nombre con avatar */}
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(s.IdProveedor)}`}>
                                                {supplierInitials(s.Proveedor)}
                                            </div>
                                            <span className="font-medium text-gray-900 truncate max-w-[160px]">
                                                {s.Proveedor}
                                            </span>
                                        </div>
                                    </TableCell>

                                    <TableCell muted>{s.RFC || '—'}</TableCell>

                                    {/* Contacto */}
                                    <TableCell>
                                        {s.Contacto ? (
                                            <div className="flex items-center gap-1.5 text-gray-600">
                                                <User size={12} className="text-gray-400 shrink-0" />
                                                <span>{s.Contacto}</span>
                                            </div>
                                        ) : <span className="text-gray-300">—</span>}
                                    </TableCell>

                                    {/* Teléfono */}
                                    <TableCell>
                                        {s.Telefonos ? (
                                            <div className="flex items-center gap-1.5 text-gray-600">
                                                <Phone size={12} className="text-gray-400 shrink-0" />
                                                <span>{s.Telefonos}</span>
                                            </div>
                                        ) : <span className="text-gray-300">—</span>}
                                    </TableCell>

                                    {/* Email */}
                                    <TableCell>
                                        {s.CorreoElectronico ? (
                                            <div className="flex items-center gap-1.5 text-gray-600">
                                                <Mail size={12} className="text-gray-400 shrink-0" />
                                                <span className="truncate max-w-[160px]">{s.CorreoElectronico}</span>
                                            </div>
                                        ) : <span className="text-gray-300">—</span>}
                                    </TableCell>

                                    {/* Tipo */}
                                    <TableCell align="center">
                                        <span className={`badge ${s.EsProveedorGasto === 1 ? 'badge-blue' : 'badge-gray'}`}>
                                            {s.EsProveedorGasto === 1 ? 'Gasto' : 'Compra'}
                                        </span>
                                    </TableCell>

                                    {/* Estatus */}
                                    <TableCell align="center">
                                        <span className={`badge ${s.Status === 0 ? 'badge-green' : 'badge-red'}`}>
                                            {s.Status === 0 ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </TableCell>

                                    {/* Acciones */}
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton
                                                icon={Pencil}
                                                label={t('editSupplier')}
                                                variant="edit"
                                                onClick={() => openEdit(s)}
                                            />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={t('deleteSupplier')}
                                                variant="delete"
                                                onClick={() => { setEditingSupplier(s); setIsDeleteModalOpen(true); }}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                </div>

                {/* Footer con conteo */}
                {!isLoading && filtered.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                            {filtered.length} de {suppliers.length} proveedores
                        </span>
                    </div>
                )}
            </div>

            {/* ── Modal Crear / Editar ─────────────────────────────────── */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingSupplier ? t('editSupplier') : t('addSupplier')}
                subtitle={editingSupplier ? `Editando: ${editingSupplier.Proveedor}` : 'Completa la información del proveedor'}
                size="lg"
                onConfirm={handleSubmit}
                confirmLabel={t('save')}
                confirmLoading={isSaving}
                cancelLabel={t('cancel')}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                        <Input
                            label={t('supplierName')}
                            value={formData.proveedor}
                            onChange={(e) => setFormData({ ...formData, proveedor: e.target.value.toUpperCase() })}
                            placeholder="Nombre del proveedor"
                            required
                        />
                    </div>
                    <Input
                        label="RFC"
                        value={formData.rfc}
                        onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                        placeholder="RFC123456ABC"
                    />
                    <Input
                        label={t('phones')}
                        value={formData.telefonos}
                        onChange={(e) => setFormData({ ...formData, telefonos: e.target.value })}
                        placeholder="555-000-0000"
                    />
                    <Input
                        label={t('email')}
                        type="email"
                        value={formData.correoElectronico}
                        onChange={(e) => setFormData({ ...formData, correoElectronico: e.target.value })}
                        placeholder="contacto@proveedor.com"
                    />
                    <Input
                        label={t('contact')}
                        value={formData.contacto}
                        onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                        placeholder="Nombre del contacto"
                    />
                    <div className="sm:col-span-2">
                        <Input
                            label={t('address')}
                            value={formData.calle}
                            onChange={(e) => setFormData({ ...formData, calle: e.target.value })}
                            placeholder="Dirección"
                        />
                    </div>

                    {/* Toggle: ¿Es proveedor de gasto? */}
                    <div className="sm:col-span-2">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, esProveedorGasto: !formData.esProveedorGasto })}
                            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${formData.esProveedorGasto
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex flex-col items-start gap-0.5">
                                <span className="text-sm font-semibold text-gray-700">¿Es proveedor de gasto?</span>
                                <span className="text-xs text-gray-400">Marcar si este proveedor es solo para gastos operativos</span>
                            </div>
                            <div className={`w-10 h-6 rounded-full transition-all relative ${formData.esProveedorGasto ? 'bg-blue-500' : 'bg-gray-200'}`}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${formData.esProveedorGasto ? 'left-5' : 'left-1'}`} />
                            </div>
                        </button>
                    </div>
                </div>
            </BaseModal>

            {/* ── Modal Confirmar Eliminación ──────────────────────────── */}
            <BaseModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Eliminar proveedor"
                size="sm"
                onConfirm={handleDelete}
                confirmLabel="Sí, eliminar"
                confirmLoading={isDeleting}
                cancelLabel={t('cancel')}
            >
                <div className="flex flex-col items-center gap-4 py-2 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertTriangle size={24} className="text-red-500" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-800">¿Eliminar a {editingSupplier?.Proveedor}?</p>
                        <p className="text-sm text-gray-500 mt-1">{t('confirmDelete')}</p>
                    </div>
                </div>
            </BaseModal>
        </PageShell>
    );
}
