'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/Button';
import Input from '@/components/Input';
import EmployeeDocumentsModal from '@/components/EmployeeDocumentsModal';
import EmployeeAccessModal from '@/components/EmployeeAccessModal';
import DocumentTypesModal from '@/components/DocumentTypesModal';
import ThemedGridHeader, { ThemedGridHeaderCell } from '@/components/ThemedGridHeader';

import { useTheme } from '@/contexts/ThemeContext';

interface Employee {
    IdEmpleado: number;
    Empleado: string;
    IdPuesto: number | null;
    Puesto: string | null;
    ImagenTipoPuesto: string | null;
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
    IdTipoPuesto?: number;
    ImagenTipoPuesto?: string;
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
        photo: '' as string | null,
        username: '',
        password: '',
        repeatPassword: '',
        isAdmin: false
    });
    const { colors } = useTheme();
    const [projectDomain, setProjectDomain] = useState('');
    const [activeTab, setActiveTab] = useState('general');
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
    const [isDocumentTypesModalOpen, setIsDocumentTypesModalOpen] = useState(false);

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
            fetchProjectDomain();
        }
    }, [project]);

    const fetchProjectDomain = async () => {
        try {
            const response = await fetch(`/api/employees/0/access?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setProjectDomain(data.domain || '');
            }
        } catch (error) {
            console.error('Error fetching domain:', error);
        }
    };

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

        if (formData.password !== formData.repeatPassword) {
            alert('Las contraseñas no coinciden');
            return;
        }

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
                    photo: formData.photo,
                    username: formData.username,
                    password: formData.password,
                    isAdmin: formData.isAdmin
                })
            });

            if (response.ok) {
                fetchEmployees();
                setIsModalOpen(false);
                setFormData({
                    name: '', positionId: '', branchId: '', phone: '', email: '', address: '', photo: null,
                    username: '', password: '', repeatPassword: '', isAdmin: false
                });
                setEditingEmployee(null);
                setActiveTab('general');
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

    const openEditModal = async (employee: Employee) => {
        setEditingEmployee(employee);

        // Fetch access data
        let accessData = { username: '', isAdmin: false };
        try {
            const response = await fetch(`/api/employees/${employee.IdEmpleado}/access?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                accessData = {
                    username: data.username || '',
                    isAdmin: data.isAdmin || false
                };
            }
        } catch (error) {
            console.error('Error fetching access data:', error);
        }

        setFormData({
            name: employee.Empleado,
            positionId: employee.IdPuesto?.toString() || '',
            branchId: employee.IdSucursal?.toString() || '',
            phone: employee.Telefonos || '',
            email: employee.CorreoElectronico || '',
            address: employee.Calle || '',
            photo: employee.ArchivoFoto || null,
            username: accessData.username,
            password: '',
            repeatPassword: '',
            isAdmin: accessData.isAdmin
        });
        setActiveTab('general');
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
                    <Button
                        variant="secondary"
                        onClick={() => setIsDocumentTypesModalOpen(true)}
                    >
                        📑 Tipos de Documento
                    </Button>
                    <Button onClick={() => {
                        setEditingEmployee(null);
                        setFormData({
                            name: '', positionId: '', branchId: '', phone: '', email: '', address: '', photo: null,
                            username: '', password: '', repeatPassword: '', isAdmin: false
                        });
                        setActiveTab('general');
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
                                    <div className="flex items-center gap-2">
                                        <span>{employee.ImagenTipoPuesto}</span>
                                        <span>{employee.Puesto || '-'}</span>
                                    </div>
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
                        {/* Header with Tabs */}
                        <div className="px-6 pt-4 pb-0" style={{ backgroundColor: colors.colorFondo1, color: colors.colorLetra }}>
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0">
                                        <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                            Empleado
                                        </span>
                                        {!editingEmployee && (
                                            <span className="bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                                NUEVO
                                            </span>
                                        )}
                                    </div>
                                    <h1 className="text-3xl font-black mb-0 leading-tight">
                                        {editingEmployee ? editingEmployee.Empleado : t('addEmployee')}
                                    </h1>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        stopWebcam();
                                    }}
                                    className="text-white hover:bg-white/20 rounded-full p-2 flex-shrink-0"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Tabs Navigation */}
                            <div className="flex gap-1 mt-6 overflow-x-auto relative px-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                                {[
                                    { id: 'general', label: 'Datos Generales', icon: '👤' },
                                    { id: 'access', label: 'Datos Acceso', icon: '🔑' },
                                    { id: 'documents', label: 'Documentos', icon: '📄', show: !!editingEmployee }
                                ].filter(tab => tab.show !== false).map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`px-4 py-2.5 rounded-t-xl transition-all duration-300 whitespace-nowrap relative flex items-center justify-center ${activeTab === tab.id
                                            ? 'bg-white text-gray-900 text-sm font-bold z-30 translate-y-[1px] border-t border-l border-r border-gray-200 shadow-[4px_-4px_10px_rgba(0,0,0,0.05)]'
                                            : 'bg-white/10 text-xs font-normal hover:bg-white/20 hover:-translate-y-0.5'
                                            }`}
                                        style={activeTab === tab.id ? {} : { color: colors.colorLetra }}
                                    >
                                        <span className="mr-2">{tab.icon}</span>
                                        {tab.label}
                                        {activeTab === tab.id && (
                                            <div className="absolute -bottom-[2px] left-0 right-0 h-[4px] bg-white z-40"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-white border-t border-gray-200">
                            <form onSubmit={handleSubmit} className="h-full flex flex-col">
                                {activeTab === 'general' && (
                                    <div className="space-y-4 max-w-4xl mx-auto w-full">
                                        <div className="flex gap-6 items-start">
                                            <div className="flex-1 space-y-4">
                                                <Input
                                                    label={t('employeeName')}
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    required
                                                />
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            {t('position')}
                                                        </label>
                                                        <select
                                                            value={formData.positionId}
                                                            onChange={(e) => setFormData({ ...formData, positionId: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                                                        >
                                                            <option value="">{t('selectPosition')}</option>
                                                            {positions.map(pos => {
                                                                const superscriptMap: { [key: number]: string } = {
                                                                    1: '¹',
                                                                    2: '²',
                                                                    3: '³'
                                                                };
                                                                const exponent = pos.IdTipoPuesto ? (superscriptMap[pos.IdTipoPuesto] || pos.IdTipoPuesto.toString()) : '';
                                                                return (
                                                                    <option key={pos.IdPuesto} value={pos.IdPuesto.toString()}>
                                                                        {pos.ImagenTipoPuesto} {pos.Puesto} {exponent}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                        <div className="mt-1 flex gap-3 text-[10px] text-gray-500 font-medium">
                                                            <span><span className="text-orange-500">1</span> Cocina</span>
                                                            <span><span className="text-orange-500">2</span> Servicio</span>
                                                            <span><span className="text-orange-500">3</span> Administración</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            {t('branch')}
                                                        </label>
                                                        <select
                                                            value={formData.branchId}
                                                            onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                                                        >
                                                            <option value="">{t('selectBranch')}</option>
                                                            {branches.map(branch => (
                                                                <option key={branch.IdSucursal} value={branch.IdSucursal.toString()}>
                                                                    {branch.Sucursal}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <Input
                                                        label={t('phone')}
                                                        value={formData.phone}
                                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                    />
                                                    <Input
                                                        label={t('email')}
                                                        value={formData.email}
                                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                        type="email"
                                                    />
                                                </div>
                                            </div>

                                            <div className="w-48 space-y-2">
                                                <label className="block text-sm font-medium text-gray-700">{t('photo')}</label>
                                                <div className="aspect-square bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative group">
                                                    {formData.photo ? (
                                                        <>
                                                            <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                                                            <button
                                                                type="button"
                                                                onClick={() => setFormData({ ...formData, photo: null })}
                                                                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                ✕
                                                            </button>
                                                        </>
                                                    ) : isWebcamActive ? (
                                                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-gray-400 text-xs text-center px-4">Arrastra una imagen o usa la cámara</span>
                                                    )}
                                                    <canvas ref={canvasRef} className="hidden" width={400} height={400} />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={isWebcamActive ? takeSnapshot : startWebcam}
                                                        className="flex-1 py-2 bg-gray-800 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                                                    >
                                                        {isWebcamActive ? 'Capturar' : 'Cámara'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="flex-1 py-2 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 transition-colors"
                                                    >
                                                        Subir
                                                    </button>
                                                    <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                {t('address')}
                                            </label>
                                            <textarea
                                                value={formData.address}
                                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                                                rows={3}
                                            />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'access' && (
                                    <div className="space-y-6 max-w-4xl mx-auto w-full py-4">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                                                    <span>🔑</span> Credenciales
                                                </h3>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Usuario
                                                    </label>
                                                    <div className="flex items-center gap-0">
                                                        <input
                                                            type="text"
                                                            value={formData.username}
                                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                                                            placeholder="usuario"
                                                        />
                                                        <div className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md text-gray-500 text-xs font-medium min-w-[120px] flex items-center justify-center">
                                                            @{projectDomain}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 mt-4">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <span className="text-sm font-bold text-gray-800 block">Es Administrador</span>
                                                            <span className="text-[10px] text-gray-500 mt-0.5 block italic">Otorga permisos elevados al usuario</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, isAdmin: !formData.isAdmin })}
                                                            className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${formData.isAdmin ? 'bg-orange-500' : 'bg-gray-200'}`}
                                                        >
                                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isAdmin ? 'translate-x-7' : 'translate-x-1'}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                                                    <span>🛡️</span> Seguridad
                                                </h3>
                                                <Input
                                                    label="Contraseña"
                                                    type="password"
                                                    value={formData.password}
                                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                    placeholder="••••••••"
                                                    className="text-sm"
                                                />
                                                <Input
                                                    label="Repetir Contraseña"
                                                    type="password"
                                                    value={formData.repeatPassword}
                                                    onChange={(e) => setFormData({ ...formData, repeatPassword: e.target.value })}
                                                    placeholder="••••••••"
                                                    className="text-sm"
                                                />
                                                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded text-[11px] text-yellow-700 leading-relaxed">
                                                    <strong>⚠️ Nota:</strong> Si el empleado ya existe, deja la contraseña en blanco para mantener la actual.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'documents' && editingEmployee && (
                                    <div className="flex-1 min-h-[400px]">
                                        <EmployeeDocumentsModal
                                            isOpen={true}
                                            onClose={() => { }}
                                            employeeId={editingEmployee.IdEmpleado}
                                            employeeName={editingEmployee.Empleado}
                                            projectId={project?.idProyecto || 0}
                                            isTabMode={true}
                                        />
                                    </div>
                                )}

                                {activeTab !== 'documents' && (
                                    <div className="mt-auto pt-6 border-t border-gray-100 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsModalOpen(false);
                                                stopWebcam();
                                            }}
                                            className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            {t('cancel')}
                                        </button>
                                        <Button type="submit" className="px-8 py-2.5">
                                            {t('save')}
                                        </Button>
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                        <h2 className="text-xl font-bold mb-4">{t('deleteEmployee')}</h2>
                        <p className="text-gray-600 mb-6 font-medium">
                            {t('confirmDelete')} <span className="text-red-600 font-bold">{editingEmployee?.Empleado}</span>?
                        </p>
                        <div className="flex justify-end gap-2">
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
                                {t('confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Documents Modal (Standalone fallback) */}
            {isDocumentsModalOpen && selectedEmployeeForDocuments && (
                <EmployeeDocumentsModal
                    isOpen={isDocumentsModalOpen}
                    onClose={() => setIsDocumentsModalOpen(false)}
                    employeeId={selectedEmployeeForDocuments.IdEmpleado}
                    employeeName={selectedEmployeeForDocuments.Empleado}
                    projectId={project?.idProyecto || 0}
                />
            )}

            {/* Document Types Modal */}
            {isDocumentTypesModalOpen && (
                <DocumentTypesModal
                    isOpen={isDocumentTypesModalOpen}
                    onClose={() => setIsDocumentTypesModalOpen(false)}
                    projectId={project?.idProyecto || 0}
                />
            )}
        </div>
    );
}
