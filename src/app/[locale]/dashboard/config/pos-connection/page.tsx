'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import PageShell from '@/components/PageShell';
import { 
    Link2, 
    CheckCircle2, 
    XCircle, 
    AlertTriangle, 
    RefreshCw, 
    Database, 
    Wifi, 
    WifiOff,
    Mail,
    Clock,
    Play,
    DownloadCloud
} from 'lucide-react';

interface POSConfig {
    Provider: 'wansoft' | 'generic_api' | 'none';
    Url?: string;
    User?: string;
    Password?: string;
    ApiKey?: string;
    ApiEndpoint?: string;
    SyncInterval: string;
    AlertsEnabled: number;
    AlertEmail?: string;
    Status: 'connected' | 'disconnected' | 'error';
    LastSync?: string | null;
}

interface SyncLog {
    IdLog: number;
    Fecha: string;
    Tipo: string;
    Status: 'success' | 'failed';
    Records: number;
    Duration: string | null;
}

export default function POSConnectionPage() {
    const t = useTranslations('Navigation');
    const { colors } = useTheme();
    const [project, setProject] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    
    // Status message states
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

    // Form data
    const [config, setConfig] = useState<POSConfig>({
        Provider: 'none',
        Url: 'https://www.wansoft.net/Wansoft.Web/',
        User: '',
        Password: '',
        ApiKey: '',
        ApiEndpoint: '',
        SyncInterval: 'daily',
        AlertsEnabled: 1,
        AlertEmail: '',
        Status: 'disconnected',
        LastSync: null
    });

    // Real synchronization logs from tblPOSSyncLog
    const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

    // Import controls: date + branch
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const [importDate, setImportDate] = useState<string>(todayStr);
    const [importBranch, setImportBranch] = useState<string>(''); // '' = todas
    const [branches, setBranches] = useState<{ IdSucursal: number; Sucursal: string }[]>([]);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) {
            setProject(JSON.parse(storedProject));
        }
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchPOSConfig();
            fetchSyncLogs();
            fetchBranches();
        }
    }, [project]);

    const fetchPOSConfig = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/config/pos-connection?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success && data.data) {
                setConfig({
                    Provider: data.data.Provider || 'none',
                    Url: data.data.Url || 'https://www.wansoft.net/Wansoft.Web/',
                    User: data.data.User || '',
                    Password: data.data.Password || '',
                    ApiKey: data.data.ApiKey || '',
                    ApiEndpoint: data.data.ApiEndpoint || '',
                    SyncInterval: data.data.SyncInterval || 'daily',
                    AlertsEnabled: data.data.AlertsEnabled !== undefined ? data.data.AlertsEnabled : 1,
                    AlertEmail: data.data.AlertEmail || '',
                    Status: data.data.Status || 'disconnected',
                    LastSync: data.data.LastSync || null
                });
            }
        } catch (error) {
            console.error('Error fetching POS config:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSyncLogs = async () => {
        try {
            const response = await fetch(`/api/config/pos-connection/sync?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                setSyncLogs(data.data);
            }
        } catch (error) {
            console.error('Error fetching sync logs:', error);
        }
    };

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/config/pos-connection/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                setBranches(data.data);
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveResult(null);
        try {
            const response = await fetch('/api/config/pos-connection', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    provider: config.Provider,
                    url: config.Url,
                    user: config.User,
                    password: config.Password,
                    apiKey: config.ApiKey,
                    apiEndpoint: config.ApiEndpoint,
                    syncInterval: config.SyncInterval,
                    alertsEnabled: config.AlertsEnabled,
                    alertEmail: config.AlertEmail,
                    status: config.Status
                })
            });

            const data = await response.json();
            if (data.success) {
                setSaveResult({ success: true, message: 'Configuración guardada correctamente.' });
                setTimeout(() => setSaveResult(null), 4000);
            } else {
                setSaveResult({ success: false, message: data.message || 'Error al guardar la configuración.' });
            }
        } catch (error) {
            console.error('Error saving POS config:', error);
            setSaveResult({ success: false, message: 'Ocurrió un error inesperado al guardar.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const response = await fetch('/api/config/pos-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'test',
                    provider: config.Provider,
                    url: config.Url,
                    user: config.User,
                    password: config.Password,
                    apiKey: config.ApiKey,
                    apiEndpoint: config.ApiEndpoint
                })
            });

            const data = await response.json();
            if (data.success) {
                setTestResult({ success: true, message: data.message });
                setConfig(prev => ({ ...prev, Status: 'connected' }));
            } else {
                setTestResult({ success: false, message: data.message || 'Error en la prueba de conexión.' });
                setConfig(prev => ({ ...prev, Status: 'error' }));
            }
        } catch (error) {
            console.error('Error testing POS connection:', error);
            setTestResult({ success: false, message: 'Ocurrió un error al intentar conectarse.' });
            setConfig(prev => ({ ...prev, Status: 'error' }));
        } finally {
            setIsTesting(false);
        }
    };

    const handleSyncNow = async () => {
        setIsSyncing(true);
        setSaveResult(null);
        try {
            const response = await fetch('/api/config/pos-connection/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    date: importDate || undefined,
                    branchId: importBranch || undefined
                })
            });
            const data = await response.json();

            // Refrescar bitácora y estado desde la BD (el scraper ya los actualizó).
            await fetchSyncLogs();
            await fetchPOSConfig();

            setSaveResult({
                success: !!data.success,
                message: data.message || (data.success ? 'Sincronización completada.' : 'La sincronización falló.')
            });
            setTimeout(() => setSaveResult(null), 6000);
        } catch (e) {
            console.error(e);
            setSaveResult({ success: false, message: 'Ocurrió un error al ejecutar la sincronización.' });
        } finally {
            setIsSyncing(false);
        }
    };

    // Helper to format status badges
    const getStatusBadge = (status: POSConfig['Status']) => {
        switch (status) {
            case 'connected':
                return (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Conectado
                    </div>
                );
            case 'error':
                return (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                        <WifiOff size={12} className="text-rose-500 animate-pulse" />
                        Error de Conexión
                    </div>
                );
            case 'disconnected':
            default:
                return (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                        <WifiOff size={12} className="text-gray-400" />
                        Sin Conexión
                    </div>
                );
        }
    };

    if (isLoading) {
        return (
            <PageShell title="Conexión a Punto de Venta" icon={Link2}>
                <div className="flex justify-center items-center h-64">
                    <RefreshCw className="animate-spin text-gray-400" size={32} />
                    <span className="ml-3 text-gray-500 font-medium">Cargando configuración...</span>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell
            title="Conexión a Punto de Venta"
            subtitle="Configura y prueba la vinculación de ventas automatizada con tu sistema POS."
            icon={Link2}
            actions={
                <div className="flex items-center gap-3">
                    {getStatusBadge(config.Status)}
                    <button
                        onClick={handleSyncNow}
                        disabled={isSyncing || config.Provider === 'none'}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-white text-gray-700 border border-gray-200 shadow-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                        Sincronizar ahora
                    </button>
                </div>
            }
        >
            <div className="max-w-6xl mx-auto py-4 space-y-6">
                
                {/* Save message notification */}
                {saveResult && (
                    <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                        saveResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}>
                        {saveResult.success ? <CheckCircle2 size={20} className="text-emerald-500" /> : <XCircle size={20} className="text-rose-500" />}
                        <span className="text-sm font-medium">{saveResult.message}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left Column: Form Settings */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* Main Settings Card */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gray-50 text-gray-600">
                                    <Database size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">Proveedor de Punto de Venta</h3>
                                    <p className="text-xs text-gray-500">Selecciona el sistema de punto de venta que utiliza tu negocio.</p>
                                </div>
                            </div>
                            
                            <div className="p-6 space-y-6">
                                {/* Provider selector */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Proveedor</label>
                                    <select
                                        value={config.Provider}
                                        onChange={(e) => setConfig(prev => ({ 
                                            ...prev, 
                                            Provider: e.target.value as POSConfig['Provider'],
                                            Status: 'disconnected' // Reset status on change
                                        }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all"
                                    >
                                        <option value="none">Deshabilitado (Ingreso Manual de Ventas)</option>
                                        <option value="wansoft">Wansoft REST API / Web Scraper</option>
                                        <option value="generic_api">API Genérica (Webhook / JSON Endpoint)</option>
                                    </select>
                                </div>

                                {/* Dynamic inputs - Wansoft */}
                                {config.Provider === 'wansoft' && (
                                    <div className="space-y-4 pt-2 border-t border-gray-100 animate-fadeIn">
                                        <h4 className="font-bold text-sm text-gray-700 mb-2">Configuración Wansoft</h4>
                                        <Input
                                            label="URL del Portal Wansoft"
                                            value={config.Url}
                                            onChange={(e) => setConfig(prev => ({ ...prev, Url: e.target.value }))}
                                            placeholder="https://www.wansoft.net/Wansoft.Web/"
                                        />
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Input
                                                label="Usuario"
                                                value={config.User}
                                                onChange={(e) => setConfig(prev => ({ ...prev, User: e.target.value }))}
                                                placeholder="Ej. usuario@empresa.com"
                                            />
                                            <Input
                                                label="Contraseña"
                                                type="password"
                                                value={config.Password}
                                                onChange={(e) => setConfig(prev => ({ ...prev, Password: e.target.value }))}
                                                placeholder="••••••••••••"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Dynamic inputs - Generic API */}
                                {config.Provider === 'generic_api' && (
                                    <div className="space-y-4 pt-2 border-t border-gray-100 animate-fadeIn">
                                        <h4 className="font-bold text-sm text-gray-700 mb-2">Configuración de API Genérica</h4>
                                        <Input
                                            label="Endpoint de API (URL)"
                                            value={config.ApiEndpoint}
                                            onChange={(e) => setConfig(prev => ({ ...prev, ApiEndpoint: e.target.value }))}
                                            placeholder="https://api.tu-servidor.com/v1/sales"
                                        />
                                        <Input
                                            label="Clave de API (Authorization Bearer / Token)"
                                            type="password"
                                            value={config.ApiKey}
                                            onChange={(e) => setConfig(prev => ({ ...prev, ApiKey: e.target.value }))}
                                            placeholder="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                        />
                                    </div>
                                )}

                                {/* Informational Box when disabled */}
                                {config.Provider === 'none' && (
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex gap-3 text-gray-600">
                                        <AlertTriangle size={20} className="text-gray-400 shrink-0" />
                                        <p className="text-sm">
                                            Con el punto de venta deshabilitado, la carga de datos se realizará exclusivamente a través de los formularios manuales de <strong>Ventas por Forma de Pago</strong> y <strong>Captura de Ventas</strong>.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Scheduling & Alerts Card */}
                        {config.Provider !== 'none' && (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-gray-50 text-gray-600">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">Sincronización y Notificaciones</h3>
                                        <p className="text-xs text-gray-500">Configura la automatización y alertas del integrador de punto de venta.</p>
                                    </div>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {/* Frequency */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Frecuencia de Sincronización</label>
                                            <select
                                                value={config.SyncInterval}
                                                onChange={(e) => setConfig(prev => ({ ...prev, SyncInterval: e.target.value }))}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all"
                                            >
                                                <option value="hourly">Cada Hora (Tiempo Real)</option>
                                                <option value="daily">Diario (Al finalizar el día)</option>
                                                <option value="weekly">Semanal (Domingo por la noche)</option>
                                            </select>
                                        </div>

                                        {/* Toggle Alerts */}
                                        <div className="space-y-2 flex flex-col justify-end pb-1.5">
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Alertas por Email</span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={config.AlertsEnabled === 1}
                                                    onChange={(e) => setConfig(prev => ({ ...prev, AlertsEnabled: e.target.checked ? 1 : 0 }))}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                <span className="ml-3 text-sm font-medium text-gray-700">Habilitar avisos de error</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Alert email */}
                                    {config.AlertsEnabled === 1 && (
                                        <div className="animate-fadeIn">
                                            <Input
                                                label="Correo Electrónico para Alertas"
                                                value={config.AlertEmail}
                                                onChange={(e) => setConfig(prev => ({ ...prev, AlertEmail: e.target.value }))}
                                                placeholder="alertas@tudominio.com"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-4">
                            {config.Provider !== 'none' && (
                                <button
                                    onClick={handleTestConnection}
                                    disabled={isTesting || isSaving}
                                    style={{ color: colors.colorFondo1, borderColor: `${colors.colorFondo1}50` }}
                                    className="px-5 py-2.5 rounded-xl border bg-white font-bold hover:bg-gray-50 disabled:opacity-50 transition-all text-sm flex items-center gap-2"
                                >
                                    <Wifi size={16} className={isTesting ? 'animate-pulse' : ''} />
                                    {isTesting ? 'Probando...' : 'Probar Conexión'}
                                </button>
                            )}
                            
                            <Button
                                                                onClick={handleSave}
                                                                disabled={isSaving || isTesting}
                                                                isLoading={isSaving}
                                                                size="md"
                                                            >
                                Guardar Configuración
                            </Button>
                        </div>
                    </div>

                    {/* Right Column: Connection state & logs */}
                    <div className="space-y-6">

                        {/* Import CTA */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gray-50 text-gray-600">
                                    <DownloadCloud size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">Importar información</h3>
                                    <p className="text-xs text-gray-500">Trae el consolidado y todos los reportes de Wansoft.</p>
                                </div>
                            </div>

                            {/* Filtros: fecha y sucursal */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Fecha</label>
                                    <input
                                        type="date"
                                        value={importDate}
                                        max={todayStr}
                                        onChange={(e) => setImportDate(e.target.value)}
                                        disabled={isSyncing || config.Provider === 'none'}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Sucursal</label>
                                    <select
                                        value={importBranch}
                                        onChange={(e) => setImportBranch(e.target.value)}
                                        disabled={isSyncing || config.Provider === 'none'}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-all"
                                    >
                                        <option value="">Todas las sucursales</option>
                                        {branches.map((b) => (
                                            <option key={b.IdSucursal} value={b.IdSucursal}>{b.Sucursal}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleSyncNow}
                                disabled={isSyncing || config.Provider === 'none'}
                                style={config.Provider !== 'none' ? { backgroundColor: colors.colorFondo1 } : undefined}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-bold shadow-sm hover:opacity-90 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-all"
                            >
                                <DownloadCloud size={18} className={isSyncing ? 'animate-bounce' : ''} />
                                {isSyncing ? 'Importando información…' : 'Importar información del punto de venta'}
                            </button>
                            {config.Provider === 'none' ? (
                                <p className="text-xs text-gray-400 text-center">
                                    Selecciona un proveedor (Wansoft) y guarda la configuración para habilitar la importación.
                                </p>
                            ) : (
                                <p className="text-xs text-gray-400 text-center">
                                    Puede tardar varios minutos según el número de sucursales.
                                </p>
                            )}
                        </div>

                        {/* Status Summary Widget */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
                            <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider text-gray-500">Estado de Integración</h3>
                            
                            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                                <div className="flex justify-between items-center text-xs font-semibold text-gray-600">
                                    <span>Última Sincronización:</span>
                                    <span className="text-gray-900 font-bold">{config.LastSync ? new Date(config.LastSync).toLocaleString('es-MX') : 'Nunca'}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-semibold text-gray-600">
                                    <span>Integrador Activo:</span>
                                    <span className="text-gray-900 font-bold uppercase">{config.Provider === 'none' ? 'Ninguno' : config.Provider}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-semibold text-gray-600">
                                    <span>Alertas Automáticas:</span>
                                    <span className="text-gray-900 font-bold">{config.AlertsEnabled === 1 ? 'Sí' : 'No'}</span>
                                </div>
                            </div>

                            {testResult && (
                                <div className={`p-4 rounded-xl border flex gap-2 ${
                                    testResult.success ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
                                }`}>
                                    {testResult.success ? (
                                        <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                                    ) : (
                                        <XCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                                    )}
                                    <div className="text-xs">
                                        <p className="font-bold">{testResult.success ? 'Conexión Exitosa' : 'Fallo de Conexión'}</p>
                                        <p className="mt-1 leading-relaxed">{testResult.message}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Recent History logs */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100">
                                <h3 className="font-bold text-gray-900">Historial Reciente</h3>
                                <p className="text-xs text-gray-500">Últimas ejecuciones del importador.</p>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {syncLogs.length === 0 && (
                                    <div className="p-6 text-center text-xs text-gray-400 font-medium">
                                        Aún no hay sincronizaciones registradas.
                                    </div>
                                )}
                                {syncLogs.map((log) => (
                                    <div key={log.IdLog} className="p-4 hover:bg-gray-50/50 transition-colors flex justify-between items-center text-xs">
                                        <div className="space-y-1">
                                            <p className="font-bold text-gray-800">{log.Tipo}</p>
                                            <p className="text-gray-400 font-medium">
                                                {log.Fecha ? new Date(log.Fecha).toLocaleString('es-MX') : ''}
                                            </p>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                                                log.Status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                            }`}>
                                                {log.Status === 'success' ? 'Éxito' : 'Fallo'}
                                            </span>
                                            <p className="text-gray-500 font-semibold">{log.Records} reg • {log.Duration}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </PageShell>
    );
}
