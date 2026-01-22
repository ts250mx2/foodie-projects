'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from './Button';

interface BranchEmployeesModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId: number;
    branchName: string;
    projectId: number;
}

interface Employee {
    IdEmpleado: number;
    Empleado: string;
    IdPuesto: number;
    Puesto: string;
}

interface BranchEmployee {
    IdEmpleado: number;
    Empleado: string;
    Puesto: string;
    IdPuesto: number;
}

export default function BranchEmployeesModal({ isOpen, onClose, branchId, branchName, projectId }: BranchEmployeesModalProps) {
    const t = useTranslations('BranchEmployeesModal');

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [branchEmployees, setBranchEmployees] = useState<BranchEmployee[]>([]);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
            fetchBranchEmployees();
        }
    }, [isOpen]);

    useEffect(() => {
        // Filter employees based on search
        if (employeeSearch) {
            const filtered = employees.filter(emp =>
                emp.Empleado.toLowerCase().includes(employeeSearch.toLowerCase())
            );
            setFilteredEmployees(filtered);
        } else {
            setFilteredEmployees(employees);
        }
    }, [employeeSearch, employees]);

    const fetchEmployees = async () => {
        try {
            const response = await fetch(`/api/employees?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                // Filter only active employees with Status = 0
                const activeEmployees = data.data.filter((emp: any) => emp.Status === 0);
                setEmployees(activeEmployees);
                setFilteredEmployees(activeEmployees);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const fetchBranchEmployees = async () => {
        try {
            const response = await fetch(`/api/branch-employees?projectId=${projectId}&branchId=${branchId}`);
            const data = await response.json();
            if (data.success) {
                setBranchEmployees(data.data);
            }
        } catch (error) {
            console.error('Error fetching branch employees:', error);
        }
    };

    const handleEmployeeSelect = async (employee: Employee) => {
        try {
            const response = await fetch('/api/branch-employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    branchId,
                    employeeId: employee.IdEmpleado
                })
            });

            if (response.ok) {
                setEmployeeSearch('');
                setShowEmployeeDropdown(false);
                fetchBranchEmployees();
            }
        } catch (error) {
            console.error('Error adding employee:', error);
        }
    };

    const handleDelete = async (employeeId: number) => {
        if (!confirm(t('confirmDelete'))) return;

        try {
            const response = await fetch(
                `/api/branch-employees?projectId=${projectId}&branchId=${branchId}&employeeId=${employeeId}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                fetchBranchEmployees();
            }
        } catch (error) {
            console.error('Error removing employee:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">
                        {t('title')} - {branchName}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">✕</button>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Employee Selector Section */}
                        <div>
                            <div className="bg-gradient-to-br from-orange-50 to-pink-50 p-6 rounded-xl border border-orange-200">
                                <h3 className="text-sm font-bold text-orange-600 mb-4 uppercase">{t('addEmployee')}</h3>

                                {/* Employee Search */}
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('employee')}
                                    </label>
                                    <input
                                        type="text"
                                        value={employeeSearch}
                                        onChange={(e) => {
                                            setEmployeeSearch(e.target.value);
                                            setShowEmployeeDropdown(true);
                                        }}
                                        onFocus={() => setShowEmployeeDropdown(true)}
                                        placeholder={t('searchEmployee')}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                    {showEmployeeDropdown && filteredEmployees.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                            {filteredEmployees.map((emp) => {
                                                // Check if employee is already assigned
                                                const isAssigned = branchEmployees.some(be => be.IdEmpleado === emp.IdEmpleado);

                                                return (
                                                    <div
                                                        key={emp.IdEmpleado}
                                                        onClick={() => !isAssigned && handleEmployeeSelect(emp)}
                                                        className={`px-3 py-2 ${isAssigned ? 'bg-gray-100 cursor-not-allowed opacity-50' : 'hover:bg-orange-50 cursor-pointer'}`}
                                                    >
                                                        <div className="font-medium">{emp.Empleado}</div>
                                                        <div className="text-xs text-gray-500">{emp.Puesto}</div>
                                                        {isAssigned && <div className="text-xs text-orange-600">✓ Ya asignado</div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Assigned Employees Grid */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-600 mb-4 uppercase">Empleados Asignados</h3>
                            {branchEmployees.length === 0 ? (
                                <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg">
                                    {t('noEmployees')}
                                </div>
                            ) : (
                                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">{t('employee')}</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">{t('position')}</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {branchEmployees.map((emp) => (
                                                <tr key={emp.IdEmpleado} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{emp.Empleado}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{emp.Puesto}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => handleDelete(emp.IdEmpleado)}
                                                            className="text-lg hover:scale-125 transition-transform"
                                                            title="Eliminar"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-medium"
                    >
                        {t('close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
