'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
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
    ArchivoFoto: string | null;
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
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        positionId: '',
        branchId: '',
        phone: '',
        email: '',
        address: '',
        photo: '' as string | null
    });
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isWebcamActive, setIsWebcamActive] = useState(false);
    const [project, setProject] = useState<any>(null);

    // Modal state
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
                    // Branch state simplified
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
                    address: formData.address,
                    photo: formData.photo
                })
            });

            if (response.ok) {
                fetchEmployees();
                setIsModalOpen(false);
                setFormData({ name: '', positionId: '', branchId: '', phone: '', email: '', address: '', photo: null });
                setEditingEmployee(null);
                stopWebcam();
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
            address: employee.Calle || '',
            photo: employee.ArchivoFoto || null
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

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, photo: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const startWebcam = async () => {
        setIsWebcamActive(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error('Error accessing webcam:', err);
            alert('No se pudo acceder a la cámara');
            setIsWebcamActive(false);
        }
    };

    const stopWebcam = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsWebcamActive(false);
    };

    const takeSnapshot = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setFormData(prev => ({ ...prev, photo: dataUrl }));
                stopWebcam();
            }
        }
    };

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
                    <Button onClick={() => {
                        setEditingEmployee(null);
                        setFormData({ name: '', positionId: '', branchId: '', phone: '', email: '', address: '', photo: null });
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
                                    <div className="flex items-center gap-3">
                                        {employee.ArchivoFoto ? (
                                            <img src={employee.ArchivoFoto} alt="" className="w-8 h-8 rounded-full object-cover border" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs border">
                                                👤
                                            </div>
                                        )}
                                        {employee.Empleado}
                                    </div>
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
                                        onClick={() => openEditModal(employee)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title={t('editEmployee')}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => openAccessModal(employee)}
                                        className="text-xl mr-4 hover:scale-110 transition-transform"
                                        title="Acceso"
                                    >
                                        🔑
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
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    stopWebcam();
                                }}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <span className="text-2xl">✕</span>
                            </button>

                            <h2 className="text-xl font-bold mb-4">
                                {editingEmployee ? t('editEmployee') : t('addEmployee')}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="flex gap-6 items-start">
                                    <div className="flex-1 space-y-4">
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
                                    </div>

                                    <div className="w-48 space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">{t('photo')}</label>
                                        <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center">
                                            {isWebcamActive ? (
                                                <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                                            ) : formData.photo ? (
                                                <img src={formData.photo} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-4xl">👤</span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {isWebcamActive ? (
                                                <button
                                                    type="button"
                                                    onClick={takeSnapshot}
                                                    className="col-span-2 py-1 px-2 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                                >
                                                    📸 {t('takeSnapshot')}
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="py-1 px-2 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                                                    >
                                                        📁 {t('uploadPhoto')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={startWebcam}
                                                        className="py-1 px-2 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                                                    >
                                                        📹 {t('takePhoto')}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handlePhotoUpload}
                                        />
                                        <canvas ref={canvasRef} className="hidden" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-4">
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
                                </div>

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
                                        onClick={() => {
                                            setIsModalOpen(false);
                                            stopWebcam();
                                        }}
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
                )
            }

            {/* Delete Confirmation Modal */}
            {
                isDeleteModalOpen && (
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
                )
            }


            {
                selectedEmployeeForDocuments && (
                    <EmployeeDocumentsModal
                        isOpen={isDocumentsModalOpen}
                        onClose={() => setIsDocumentsModalOpen(false)}
                        employeeId={selectedEmployeeForDocuments.IdEmpleado}
                        employeeName={selectedEmployeeForDocuments.Empleado}
                        projectId={project?.idProyecto}
                    />
                )
            }

            {
                selectedEmployeeForAccess && (
                    <EmployeeAccessModal
                        isOpen={isAccessModalOpen}
                        onClose={() => setIsAccessModalOpen(false)}
                        employeeId={selectedEmployeeForAccess.IdEmpleado}
                        employeeName={selectedEmployeeForAccess.Empleado}
                        projectId={project?.idProyecto}
                    />
                )
            }
        </div >
    );
}
