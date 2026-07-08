'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import { Search, Pencil, Trash2, Plus, Check, X } from 'lucide-react';

interface Tax {
    IdImpuesto: number;
    Descripcion: string;
    Impuesto: number;
    Status: number;
}

const EMPTY_FORM = { description: '', percentage: '' };

/**
 * Administración de impuestos del proyecto (lista + alta/edición/borrado con
 * formularios y confirmaciones EN LÍNEA, sin modales anidados). Se reutiliza tanto
 * incrustado en un modal (botón "Impuestos" de la pestaña Proyecto) como en la ruta
 * directa /dashboard/config/taxes.
 */
export default function TaxesPanel({ projectId }: { projectId: number }) {
    const [taxes, setTaxes] = useState<Tax[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Tax, direction: 'asc' | 'desc' } | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Tax | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });
    const [isSaving, setIsSaving] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    const fetchTaxes = useCallback(async () => {
        if (!projectId) return;
        try {
            const response = await fetch(`/api/taxes?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) setTaxes(data.data);
        } catch (error) {
            console.error('Error fetching taxes:', error);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => { fetchTaxes(); }, [fetchTaxes]);

    const openNew = () => {
        setEditing(null);
        setFormData({ ...EMPTY_FORM });
        setShowForm(true);
    };

    const openEdit = (tax: Tax) => {
        setEditing(tax);
        setFormData({ description: tax.Descripcion, percentage: tax.Impuesto.toString() });
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditing(null);
        setFormData({ ...EMPTY_FORM });
    };

    const handleSubmit = async () => {
        if (!formData.description.trim() || formData.percentage === '') return;
        setIsSaving(true);
        try {
            const payload: any = {
                projectId,
                description: formData.description.trim(),
                percentage: parseFloat(formData.percentage),
            };
            if (editing) payload.id = editing.IdImpuesto;

            const response = await fetch('/api/taxes', {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (response.ok) {
                await fetchTaxes();
                closeForm();
            }
        } catch (error) {
            console.error('Error saving tax:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const response = await fetch(`/api/taxes?projectId=${projectId}&id=${id}`, { method: 'DELETE' });
            if (response.ok) {
                await fetchTaxes();
                setConfirmDeleteId(null);
            }
        } catch (error) {
            console.error('Error deleting tax:', error);
        }
    };

    const handleSort = (key: keyof Tax) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const sortedAndFiltered = taxes
        .filter((tax) => tax.Descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    return (
        <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar impuesto…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none transition-all placeholder:text-gray-400 text-gray-700"
                    />
                </div>
                <Button onClick={openNew} variant="solid" leftIcon={Plus} iconBox size="sm">
                    Agregar impuesto
                </Button>
            </div>

            {/* Formulario en línea (alta/edición) */}
            {showForm && (
                <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                    <h4 className="text-sm font-bold text-gray-900 mb-3">{editing ? 'Editar impuesto' : 'Nuevo impuesto'}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                            label="Descripción"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Ej. IVA"
                            required
                        />
                        <div className="w-full flex flex-col gap-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Porcentaje (%)</label>
                            <input
                                type="number" step="0.01" min="0" max="100"
                                value={formData.percentage}
                                onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                                placeholder="0.00"
                                className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500 text-gray-800"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                        <Button variant="secondary" size="sm" leftIcon={X} onClick={closeForm} disabled={isSaving}>Cancelar</Button>
                        <Button variant="solid" size="sm" leftIcon={Check} iconBox onClick={handleSubmit} isLoading={isSaving}>Guardar</Button>
                    </div>
                </div>
            )}

            {/* Tabla */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader className="sticky top-0 z-10 shadow-sm">
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Descripcion' ? sortConfig.direction : null}
                                onClick={() => handleSort('Descripcion')}
                            >
                                Descripción
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell
                                sortable
                                sortDir={sortConfig?.key === 'Impuesto' ? sortConfig.direction : null}
                                onClick={() => handleSort('Impuesto')}
                            >
                                Porcentaje
                            </ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>Activo</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">Acciones</ThemedGridHeaderCell>
                        </ThemedGridHeader>
                        <TableBody
                            loading={isLoading}
                            empty={sortedAndFiltered.length === 0}
                            emptyMessage={searchTerm ? 'Sin resultados para tu búsqueda' : 'Aún no hay impuestos. Agrega el primero.'}
                            colSpan={4}
                        >
                            {sortedAndFiltered.map((tax) => (
                                <TableRow key={tax.IdImpuesto}>
                                    <TableCell>
                                        <span className="font-medium text-gray-900">{tax.Descripcion}</span>
                                    </TableCell>
                                    <TableCell muted>{tax.Impuesto}%</TableCell>
                                    <TableCell>
                                        <span className={`badge ${tax.Status === 0 ? 'badge-green' : 'badge-red'}`}>
                                            {tax.Status === 0 ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </TableCell>
                                    <TableCell align="right">
                                        {confirmDeleteId === tax.IdImpuesto ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-xs text-gray-500">¿Eliminar?</span>
                                                <button
                                                    onClick={() => handleDelete(tax.IdImpuesto)}
                                                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 rounded-md hover:bg-rose-50"
                                                >
                                                    Sí
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100"
                                                >
                                                    No
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-1">
                                                <RowActionButton icon={Pencil} label="Editar" variant="edit" onClick={() => openEdit(tax)} />
                                                <RowActionButton icon={Trash2} label="Eliminar" variant="delete" onClick={() => setConfirmDeleteId(tax.IdImpuesto)} />
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                </div>

                {!isLoading && sortedAndFiltered.length > 0 && (
                    <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <span className="text-xs text-gray-600 font-medium">
                            {sortedAndFiltered.length} de {taxes.length} impuestos
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
