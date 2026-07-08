'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Settings, TrendingUp, Calendar, Briefcase, Clock, ShoppingCart, CreditCard } from 'lucide-react';
import BranchCostsModal from './BranchCostsModal';
import BranchInventoryDatesModal from './BranchInventoryDatesModal';
import BranchDocumentsModal from './BranchDocumentsModal';
import BranchShiftsModal from './BranchShiftsModal';
import BranchSalesChannelsModal from './BranchSalesChannelsModal';
import BranchPaymentMethodsModal from './BranchPaymentMethodsModal';
import BranchPayrollModal from './BranchPayrollModal';
import Input from './Input';
import Button from './Button';
import { useTheme } from '@/contexts/ThemeContext';

interface BranchEditContentProps {
    branch: any;
    projectId: number;
    onUpdate: () => void;
    /** Se invoca al cerrar (p. ej. tras crear una sucursal nueva sin callback específico). */
    onClose?: () => void;
    /** Se invoca con el id de la sucursal recién creada (modo pestañas). */
    onCreated?: (id: number) => void;
    initialTab?: string;
}

/**
 * Cuerpo editable de una sucursal (pestañas internas: General, Costos, Inventarios,
 * Nómina, Turnos, Canales de Venta, Formas de Pago) SIN el marco de modal.
 * Lo usa tanto BranchEditModal (envuelto en su modal) como la página de
 * Configuración General (incrustado dentro de la pestaña de cada sucursal).
 *
 * Móntalo con `key={branch.IdSucursal}` para que al cambiar de sucursal se reinicie
 * limpio su estado interno.
 */
export default function BranchEditContent({
    branch,
    projectId,
    onUpdate,
    onClose,
    onCreated,
    initialTab = 'general',
}: BranchEditContentProps) {
    const { colors } = useTheme();
    const t = useTranslations('Branches');
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: branch?.Sucursal || '',
        address: branch?.Calle || '',
        phone: branch?.Telefonos || '',
        email: branch?.CorreoElectronico || '',
        managerId: branch?.IdEmpleadoGerente || '',
        tipoNomina: branch?.TipoNomina || 0,
        diaInicio: branch?.DiaInicio || 1,
        impuestoDefault: branch?.ImpuestoDefault || ''
    });
    const [initialTipoNomina, setInitialTipoNomina] = useState(branch?.TipoNomina || 0);
    const [initialDiaInicio, setInitialDiaInicio] = useState(branch?.DiaInicio || 1);
    const [employees, setEmployees] = useState<any[]>([]);
    const [taxes, setTaxes] = useState<any[]>([]);

    useEffect(() => {
        fetchEmployees();
        fetchTaxes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchEmployees = async () => {
        try {
            const response = await fetch(`/api/employees?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) setEmployees(data.data);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const fetchTaxes = async () => {
        try {
            const response = await fetch(`/api/taxes?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) setTaxes(data.data);
        } catch (error) {
            console.error('Error fetching taxes:', error);
        }
    };

    const isNewBranch = !branch || branch.IdSucursal === 0;

    const handleGeneralSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const endpoint = isNewBranch ? '/api/branches' : `/api/branches/${branch.IdSucursal}`;
            const method = isNewBranch ? 'POST' : 'PUT';

            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    branch: formData.name,
                    phone: formData.phone,
                    email: formData.email,
                    address: formData.address,
                    managerId: formData.managerId || null,
                    tipoNomina: formData.tipoNomina,
                    diaInicio: formData.diaInicio,
                    impuestoDefault: formData.impuestoDefault || null
                })
            });
            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                onUpdate();
                setInitialTipoNomina(formData.tipoNomina);
                setInitialDiaInicio(formData.diaInicio);
                if (isNewBranch) {
                    if (onCreated && data?.id) onCreated(Number(data.id));
                    else onClose?.();
                }
            }
        } catch (error) {
            console.error('Error saving branch:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveTipoNomina = async () => {
        setIsSaving(true);
        try {
            const endpoint = `/api/branches/${branch.IdSucursal}`;
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    branch: formData.name,
                    phone: formData.phone,
                    email: formData.email,
                    address: formData.address,
                    managerId: formData.managerId || null,
                    tipoNomina: formData.tipoNomina,
                    diaInicio: formData.diaInicio,
                    impuestoDefault: formData.impuestoDefault || null
                })
            });
            if (response.ok) {
                onUpdate();
                setInitialTipoNomina(formData.tipoNomina);
                setInitialDiaInicio(formData.diaInicio);
            }
        } catch (error) {
            console.error('Error saving payroll type:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const tabs = [
        { id: 'general', label: 'Configuración General', icon: Settings, show: true },
        { id: 'costs', label: 'Objetivos y Costos', icon: TrendingUp, show: !isNewBranch },
        { id: 'inventory', label: 'Inventarios/Ventas', icon: Calendar, show: !isNewBranch },
        { id: 'payroll', label: 'Nomina', icon: Briefcase, show: !isNewBranch },
        { id: 'shifts', label: 'Turnos', icon: Clock, show: !isNewBranch },
        { id: 'sales-channels', label: 'Canales de Venta', icon: ShoppingCart, show: !isNewBranch },
        { id: 'payment-methods', label: 'Formas de Pago', icon: CreditCard, show: !isNewBranch }
    ];

    const noop = () => { };

    return (
        <div className="flex flex-col">
            {/* Tabs Navigation internas de la sucursal */}
            <div className="bg-gray-50 border-b border-gray-200 px-3">
                <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {tabs.filter(tab => tab.show).map(tab => {
                        const isActive = activeTab === tab.id;
                        const IconComponent = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`relative px-4 py-2.5 flex items-center gap-2 text-sm transition-all whitespace-nowrap rounded-t-lg ${isActive
                                    ? 'bg-white text-gray-900 font-semibold shadow-[0_-2px_8px_rgba(0,0,0,0.06)] -mb-px border border-b-0 border-gray-200'
                                    : 'text-gray-500 hover:text-gray-800 hover:bg-white/60 font-medium'
                                    }`}
                                style={isActive ? {
                                    borderBottom: `3px solid ${colors.colorFondo1}`,
                                    marginBottom: '-1px',
                                } : {}}
                            >
                                <IconComponent size={16} style={isActive ? { color: colors.colorFondo1 } : {}} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex flex-col p-6 bg-white">
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
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm"
                                    >
                                        <option value="">-- Sin Gerente --</option>
                                        {employees.map(emp => (
                                            <option key={emp.IdEmpleado} value={emp.IdEmpleado}>
                                                {emp.Empleado}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('defaultTax') || 'Impuesto Default Ventas'}
                                    </label>
                                    <select
                                        value={formData.impuestoDefault}
                                        onChange={(e) => setFormData({ ...formData, impuestoDefault: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-sm"
                                    >
                                        <option value="">-- Sin Impuesto --</option>
                                        {taxes.map(tax => (
                                            <option key={tax.IdImpuesto} value={tax.IdImpuesto}>
                                                {tax.Descripcion} ({tax.Impuesto}%)
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                    rows={3}
                                />
                            </div>
                            <div className="flex justify-end pt-4 border-t">
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? 'Guardando...' : isNewBranch ? 'Crear Sucursal' : 'Guardar Cambios'}
                                </Button>
                            </div>
                        </form>

                        {!isNewBranch && (
                            <div className="mt-12 pt-8 border-t border-gray-100">
                                <h2 className="text-xl font-bold text-gray-800 mb-6 font-black uppercase tracking-tight">Documentos de Sucursal</h2>
                                <BranchDocumentsModal
                                    isOpen={true}
                                    onClose={onClose ?? noop}
                                    branchId={branch.IdSucursal}
                                    branchName={branch.Sucursal}
                                    projectId={projectId}
                                    isTabMode={true}
                                />
                            </div>
                        )}
                    </div>
                )}

                {!isNewBranch && activeTab === 'costs' && (
                    <BranchCostsModal
                        isOpen={true}
                        onClose={onClose ?? noop}
                        branchId={branch.IdSucursal}
                        branchName={branch.Sucursal}
                        projectId={projectId}
                        isTabMode={true}
                    />
                )}

                {!isNewBranch && activeTab === 'inventory' && (
                    <BranchInventoryDatesModal
                        isOpen={true}
                        onClose={onClose ?? noop}
                        branchId={branch.IdSucursal}
                        branchName={branch.Sucursal}
                        projectId={projectId}
                        isTabMode={true}
                    />
                )}

                {!isNewBranch && activeTab === 'payroll' && (
                    <BranchPayrollModal
                        isOpen={true}
                        onClose={onClose ?? noop}
                        branchId={branch.IdSucursal}
                        branchName={branch.Sucursal}
                        projectId={projectId}
                        tipoNomina={formData.tipoNomina}
                        initialTipoNomina={initialTipoNomina}
                        diaInicio={formData.diaInicio}
                        initialDiaInicio={initialDiaInicio}
                        onTipoNominaChange={(value) => setFormData({ ...formData, tipoNomina: value })}
                        onDiaInicioChange={(value) => setFormData({ ...formData, diaInicio: value })}
                        onSaveTipoNomina={handleSaveTipoNomina}
                        isTabMode={true}
                    />
                )}

                {!isNewBranch && activeTab === 'shifts' && (
                    <BranchShiftsModal
                        isOpen={true}
                        onClose={onClose ?? noop}
                        branchId={branch.IdSucursal.toString()}
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
    );
}
