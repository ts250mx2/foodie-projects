'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import BranchCostsModal from './BranchCostsModal';
import BranchInventoryDatesModal from './BranchInventoryDatesModal';
import BranchDocumentsModal from './BranchDocumentsModal';
import BranchShiftsModal from './BranchShiftsModal';
import BranchEmployeesModal from './BranchEmployeesModal';
import BranchSalesChannelsModal from './BranchSalesChannelsModal';
import BranchPaymentMethodsModal from './BranchPaymentMethodsModal';
import Input from './Input';
import Button from './Button';
import { useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface BranchEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    branch: any;
    projectId: number;
    initialTab?: string;
    onUpdate: () => void;
}

export default function BranchEditModal({
    isOpen,
    onClose,
    branch,
    projectId,
    initialTab = 'general',
    onUpdate
}: BranchEditModalProps) {
    const { colors } = useTheme();
    const t = useTranslations('Dashboard.branches');
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: branch?.Sucursal || '',
        address: branch?.Calle || '',
        phone: branch?.Telefonos || '',
        email: branch?.CorreoElectronico || '',
        managerId: branch?.IdEmpleadoGerente || ''
    });
    const [employees, setEmployees] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
            if (activeTab === 'general') {
                setFormData({
                    name: branch?.Sucursal || '',
                    address: branch?.Calle || '',
                    phone: branch?.Telefonos || '',
                    email: branch?.CorreoElectronico || '',
                    managerId: branch?.IdEmpleadoGerente || ''
                });
            }
        }
    }, [isOpen, branch]);

    const fetchEmployees = async () => {
        try {
            const response = await fetch(`/api/employees?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setEmployees(data.data);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    if (!isOpen) return null;

    const handleGeneralSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const isNew = !branch || branch.IdSucursal === 0;
            const endpoint = isNew ? '/api/branches' : `/api/branches/${branch.IdSucursal}`;
            const method = isNew ? 'POST' : 'PUT';

            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    branch: formData.name,
                    phone: formData.phone,
                    email: formData.email,
                    address: formData.address,
                    managerId: formData.managerId || null
                })
            });
            if (response.ok) {
                onUpdate();
                if (isNew) {
                    onClose();
                }
            }
        } catch (error) {
            console.error('Error saving branch:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const isNewBranch = !branch || branch.IdSucursal === 0;

    const tabs = [
        { id: 'general', label: 'Configuración General', icon: '✏️', show: true },
        { id: 'costs', label: 'Objetivos y Costos', icon: '🎯', show: !isNewBranch },
        { id: 'inventory', label: 'Fechas de Inventario', icon: '📋', show: !isNewBranch },
        { id: 'documents', label: 'Documentos', icon: '📄', show: !isNewBranch },
        { id: 'shifts', label: 'Turnos', icon: '⏰', show: !isNewBranch },
        { id: 'employees', label: 'Empleados', icon: '👥', show: !isNewBranch },
        { id: 'sales-channels', label: 'Canales de Venta', icon: '📈', show: !isNewBranch },
        { id: 'payment-methods', label: 'Formas de Pago', icon: '💳', show: !isNewBranch }
    ];

    return (
        <div className={`fixed inset-0 flex items-center justify-center bg-black/50 ${isOpen ? '' : 'hidden'} z-50 p-4`}>
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-4 pb-0" style={{ backgroundColor: colors.colorFondo1, color: colors.colorLetra }}>
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0">
                                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                    Sucursal
                                </span>
                                {isNewBranch && (
                                    <span className="bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                        NUEVA
                                    </span>
                                )}
                            </div>
                            <h1 className="text-3xl font-black mb-0 leading-tight">
                                {isNewBranch ? 'Nueva Sucursal' : branch?.Sucursal}
                            </h1>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white/20 rounded-full p-2 flex-shrink-0"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Tabs Navigation */}
                    <div className="flex gap-1 mt-6 overflow-x-auto relative px-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                        {tabs.filter(tab => tab.show).map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2.5 rounded-t-xl transition-all duration-300 whitespace-nowrap relative flex items-center justify-center ${activeTab === tab.id
                                    ? 'bg-white text-gray-900 text-sm font-bold z-30 translate-y-[1px] border-t border-l border-r border-gray-200 shadow-[4px_-4px_10px_rgba(0,0,0,0.05)]'
                                    : 'bg-white/10 text-xs font-normal hover:bg-white/20 hover:-translate-y-0.5'
                                    }`}
                                style={
                                    activeTab === tab.id
                                        ? {}
                                        : { color: colors.colorLetra }
                                }
                            >
                                <span className="mr-2">{tab.icon}</span>
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-white z-40"></div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto flex flex-col p-6 z-20 relative bg-white border-t border-gray-200">
                    {activeTab === 'general' && (
                        <div className="max-w-4xl mx-auto py-4 w-full">
                            <form onSubmit={handleGeneralSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Input
                                        label="Nombre de Sucursal"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                    <Input
                                        label="Teléfono"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                    <Input
                                        label="Correo Electrónico"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        type="email"
                                    />
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Gerente de Sucursal
                                        </label>
                                        <select
                                            value={formData.managerId}
                                            onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                                        >
                                            <option value="">-- Sin Gerente --</option>
                                            {employees.map(emp => (
                                                <option key={emp.IdEmpleado} value={emp.IdEmpleado}>
                                                    {emp.Empleado}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Dirección
                                    </label>
                                    <textarea
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                                        rows={3}
                                    />
                                </div>
                                <div className="flex justify-end pt-4 border-t">
                                    <Button type="submit" disabled={isSaving}>
                                        {isSaving ? 'Guardando...' : isNewBranch ? 'Crear Sucursal' : 'Guardar Cambios'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}

                    {!isNewBranch && activeTab === 'costs' && (
                        <BranchCostsModal
                            isOpen={true}
                            onClose={onClose}
                            branchId={branch.IdSucursal}
                            branchName={branch.Sucursal}
                            projectId={projectId}
                            isTabMode={true}
                        />
                    )}

                    {!isNewBranch && activeTab === 'inventory' && (
                        <BranchInventoryDatesModal
                            isOpen={true}
                            onClose={onClose}
                            branchId={branch.IdSucursal}
                            branchName={branch.Sucursal}
                            projectId={projectId}
                            isTabMode={true}
                        />
                    )}

                    {!isNewBranch && activeTab === 'documents' && (
                        <BranchDocumentsModal
                            isOpen={true}
                            onClose={onClose}
                            branchId={branch.IdSucursal}
                            branchName={branch.Sucursal}
                            projectId={projectId}
                            isTabMode={true}
                        />
                    )}

                    {!isNewBranch && activeTab === 'shifts' && (
                        <BranchShiftsModal
                            isOpen={true}
                            onClose={onClose}
                            branchId={branch.IdSucursal.toString()}
                            branchName={branch.Sucursal}
                            projectId={projectId}
                            isTabMode={true}
                        />
                    )}

                    {!isNewBranch && activeTab === 'employees' && (
                        <BranchEmployeesModal
                            isOpen={true}
                            onClose={onClose}
                            branchId={branch.IdSucursal}
                            branchName={branch.Sucursal}
                            projectId={projectId}
                            isTabMode={true}
                        />
                    )}

                    {!isNewBranch && activeTab === 'sales-channels' && (
                        <BranchSalesChannelsModal
                            branchId={branch.IdSucursal}
                            projectId={projectId}
                            isTabMode={true}
                        />
                    )}

                    {!isNewBranch && activeTab === 'payment-methods' && (
                        <BranchPaymentMethodsModal
                            branchId={branch.IdSucursal}
                            projectId={projectId}
                            isTabMode={true}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
