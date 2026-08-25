'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    ShieldCheck, UserRound, UserPlus, Pencil, Trash2, KeyRound, Check, Search, Crown, Briefcase,
} from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import BaseModal from '@/components/BaseModal';
import ThemedGridHeader, {
    ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton,
} from '@/components/ThemedGridHeader';
import { useToast } from '@/contexts/ToastContext';
import { PERMISSION_MENU, ALL_MENU_KEYS } from '@/lib/menu';
import { ADMIN_PERMISSIONS_ID } from '@/lib/permissions';

/**
 * Usuarios de sistema del proyecto.
 *
 * Muestra a quien puede entrar (empleados con Login y accesos que no son
 * personal), permite darlos de alta, editarlos y ajustar sus permisos de menú.
 * Incluye al ADMINISTRADOR del proyecto, que no es un empleado: sus permisos se
 * guardan bajo IdEmpleado = -1.
 */

interface SystemUser {
    idEmpleado: number;
    nombre: string;
    usuario: string;
    login: string;
    correo: string | null;
    telefono: string | null;
    esAdministrador: boolean;
    esUsuarioSistema: boolean;
    sucursal: string | null;
    puesto: string | null;
    permissions: Record<string, boolean>;
}

/** Cuenta de administrador del proyecto (tblUsuarios de la BD central). */
interface AdminAccount {
    idUsuario: number;
    nombre: string;
    correo: string;
    telefono: string;
}

interface EmpleadoSinAcceso {
    idEmpleado: number;
    nombre: string;
    correo: string | null;
}

/** Formulario del modal; idEmpleado null = alta. */
interface UserDraft {
    idEmpleado: number | null;
    nombre: string;
    usuario: string;
    correo: string;
    password: string;
    esAdministrador: boolean;
    esUsuarioSistema: boolean;
    telefono: string;
    /** Empleado existente al que se le abre acceso (solo en alta). */
    vinculaEmpleado: number | null;
    /** Cuenta central que se está editando (solo en el administrador). */
    adminIdUsuario: number | null;
    permissions: Record<string, boolean>;
}

const EMPTY_DRAFT: UserDraft = {
    idEmpleado: null,
    nombre: '',
    usuario: '',
    correo: '',
    password: '',
    esAdministrador: false,
    esUsuarioSistema: true,
    telefono: '',
    vinculaEmpleado: null,
    adminIdUsuario: null,
    permissions: {},
};

export default function SystemUsersPanel() {
    const { success, error: toastError } = useToast();
    const projectId = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('project') || '{}').idProyecto
        : null;

    const [users, setUsers] = useState<SystemUser[]>([]);
    const [sinAcceso, setSinAcceso] = useState<EmpleadoSinAcceso[]>([]);
    const [adminPermissions, setAdminPermissions] = useState<Record<string, boolean>>({});
    const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
    const [domain, setDomain] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [draft, setDraft] = useState<UserDraft | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<SystemUser | null>(null);

    const load = useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/system-users?projectId=${projectId}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.success) {
                setUsers(data.users || []);
                setSinAcceso(data.empleadosSinAcceso || []);
                setAdminPermissions(data.admin?.permissions || {});
                setAdminAccounts(data.admin?.cuentas || []);
                setDomain(data.domain || '');
            } else {
                toastError(data.message || 'No se pudieron cargar los usuarios');
            }
        } catch {
            toastError('No se pudieron cargar los usuarios');
        } finally {
            setIsLoading(false);
        }
        // toastError se recrea en cada toast: dejarlo fuera evita recargas en cadena.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    useEffect(() => { load(); }, [load]);

    /* ── Altas y ediciones ──────────────────────────────────────────────── */

    const openNew = () => setDraft({ ...EMPTY_DRAFT });

    const openEdit = (u: SystemUser) => setDraft({
        idEmpleado: u.idEmpleado,
        nombre: u.nombre || '',
        usuario: u.usuario || '',
        correo: u.correo || '',
        password: '',
        esAdministrador: u.esAdministrador,
        esUsuarioSistema: u.esUsuarioSistema,
        telefono: u.telefono || '',
        vinculaEmpleado: null,
        adminIdUsuario: null,
        permissions: { ...u.permissions },
    });

    /**
     * El administrador se edita como un usuario más: sus datos van a la BD
     * central y sus permisos a la del proyecto (bajo el id reservado).
     */
    const openAdmin = (cuenta?: AdminAccount) => setDraft({
        ...EMPTY_DRAFT,
        idEmpleado: ADMIN_PERMISSIONS_ID,
        adminIdUsuario: cuenta?.idUsuario ?? null,
        nombre: cuenta?.nombre || 'Administrador del proyecto',
        correo: cuenta?.correo || '',
        telefono: cuenta?.telefono || '',
        permissions: { ...adminPermissions },
    });

    const setPermission = (key: string, value: boolean) =>
        setDraft((d) => (d ? { ...d, permissions: { ...d.permissions, [key]: value } } : d));

    const setAllPermissions = (value: boolean) =>
        setDraft((d) => (d
            ? { ...d, permissions: Object.fromEntries(ALL_MENU_KEYS.map((k) => [k, value])) }
            : d));

    const setSectionPermissions = (keys: string[], value: boolean) =>
        setDraft((d) => (d
            ? { ...d, permissions: { ...d.permissions, ...Object.fromEntries(keys.map((k) => [k, value])) } }
            : d));

    const isAdminDraft = draft?.idEmpleado === ADMIN_PERMISSIONS_ID;

    const handleSave = async () => {
        if (!draft || !projectId) return;

        // El administrador no tiene renglón de empleado: solo van sus permisos.
        if (!isAdminDraft) {
            if (!draft.vinculaEmpleado && !draft.nombre.trim()) {
                toastError('Escribe el nombre del usuario');
                return;
            }
            if (!draft.usuario.trim()) {
                toastError('Escribe el usuario de acceso');
                return;
            }
            if (draft.idEmpleado === null && draft.password.length < 4) {
                toastError('La contraseña debe tener al menos 4 caracteres');
                return;
            }
        }

        setIsSaving(true);
        try {
            const esAlta = draft.idEmpleado === null;
            const res = await fetch('/api/system-users', {
                method: esAlta ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    idEmpleado: esAlta ? (draft.vinculaEmpleado || null) : draft.idEmpleado,
                    nombre: draft.nombre.trim(),
                    correo: draft.correo.trim(),
                    usuario: draft.usuario.trim(),
                    password: draft.password,
                    esAdministrador: draft.esAdministrador,
                    permissions: draft.permissions,
                    cuenta: isAdminDraft && draft.adminIdUsuario
                        ? {
                            idUsuario: draft.adminIdUsuario,
                            nombre: draft.nombre.trim(),
                            correo: draft.correo.trim(),
                            telefono: draft.telefono.trim(),
                            password: draft.password,
                        }
                        : undefined,
                }),
            });
            const data = await res.json();
            if (data.success) {
                success(data.message || 'Guardado');
                setDraft(null);
                await load();
            } else {
                toastError(data.message || 'No se pudo guardar');
            }
        } catch {
            toastError('No se pudo guardar');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget || !projectId) return;
        try {
            const res = await fetch(
                `/api/system-users?projectId=${projectId}&idEmpleado=${deleteTarget.idEmpleado}`,
                { method: 'DELETE' }
            );
            const data = await res.json();
            if (data.success) {
                success(data.message || 'Acceso retirado');
                setDeleteTarget(null);
                await load();
            } else {
                toastError(data.message || 'No se pudo quitar el acceso');
            }
        } catch {
            toastError('No se pudo quitar el acceso');
        }
    };

    const filtered = users.filter((u) =>
        `${u.nombre} ${u.usuario} ${u.puesto || ''}`.toLowerCase().includes(search.toLowerCase())
    );

    const permisosActivos = (perms: Record<string, boolean>) =>
        Object.values(perms).filter(Boolean).length;

    return (
        <div className="space-y-4">
            {/* Sin dominio no se puede armar el correo de acceso de nadie. */}
            {!isLoading && !domain && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-900">Este proyecto no tiene dominio de acceso</p>
                    <p className="text-xs text-amber-800 mt-0.5">
                        El correo con el que entra el personal se arma como <span className="font-mono">usuario@dominio</span>,
                        así que hasta configurarlo no se pueden crear usuarios. Ve a la pestaña <strong>Proyecto</strong>,
                        revisa el campo <strong>Dominio de acceso</strong> y guarda.
                    </p>
                </div>
            )}

            {/* Administrador del proyecto */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 grid place-items-center shrink-0">
                        <Crown size={18} />
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900">
                            {adminAccounts[0]?.nombre || 'Administrador del proyecto'}
                        </p>
                        {adminAccounts[0] ? (
                            <p className="text-xs text-gray-500 leading-snug">
                                {adminAccounts[0].correo}
                                {adminAccounts[0].telefono && <span className="text-gray-400"> · {adminAccounts[0].telefono}</span>}
                            </p>
                        ) : (
                            <p className="text-xs text-gray-500 leading-snug">
                                Es la cuenta con la que se dio de alta el proyecto; no es un empleado, así que no
                                aparece en la lista.
                            </p>
                        )}
                        <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
                            Entra con su correo, no con un usuario del dominio. Sin permisos configurados ve todos los menús.
                        </p>
                        {adminAccounts.length > 1 && (
                            <p className="text-[11px] text-amber-700 mt-0.5">
                                Este proyecto tiene {adminAccounts.length} cuentas de administrador y los permisos aplican a todas.
                            </p>
                        )}
                        <p className="text-[11px] mt-1 font-semibold" style={{ color: permisosActivos(adminPermissions) > 0 ? '#0369a1' : '#9ca3af' }}>
                            {permisosActivos(adminPermissions) > 0
                                ? `${permisosActivos(adminPermissions)} menús permitidos`
                                : 'Acceso total (sin restricciones)'}
                        </p>
                    </div>
                </div>
                <Button variant="secondary" size="sm" leftIcon={ShieldCheck} onClick={() => openAdmin(adminAccounts[0])}>
                    Editar
                </Button>
            </div>

            {/* Usuarios con acceso */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        Usuarios con acceso ({users.length})
                    </span>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar usuario…"
                                className="w-48 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-blue-500 text-gray-700"
                            />
                        </div>
                        <Button variant="solid" size="sm" leftIcon={UserPlus} iconBox onClick={openNew}>
                            Nuevo usuario
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                        <ThemedGridHeader>
                            <ThemedGridHeaderCell>Nombre</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>Usuario de acceso</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell>Tipo</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="center">Permisos</ThemedGridHeaderCell>
                            <ThemedGridHeaderCell align="right">Acciones</ThemedGridHeaderCell>
                        </ThemedGridHeader>
                        <TableBody
                            loading={isLoading}
                            empty={!isLoading && filtered.length === 0}
                            emptyMessage={search ? 'Sin resultados' : 'Nadie tiene acceso todavía. Crea el primer usuario.'}
                            colSpan={5}
                        >
                            {filtered.map((u) => (
                                <TableRow key={u.idEmpleado}>
                                    <TableCell>
                                        <span className="font-medium text-gray-900">{u.nombre}</span>
                                        {u.esAdministrador && (
                                            <span className="ml-2 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                                                Admin
                                            </span>
                                        )}
                                        {u.puesto && <span className="block text-[11px] text-gray-400">{u.puesto}</span>}
                                    </TableCell>
                                    <TableCell muted>
                                        <span className="tabular-nums">{u.login}</span>
                                    </TableCell>
                                    <TableCell>
                                        {u.esUsuarioSistema ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                                                <UserRound size={11} /> Solo acceso
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">
                                                <Briefcase size={11} /> Empleado
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell align="center">
                                        {u.esAdministrador ? (
                                            <span className="text-[11px] font-semibold text-amber-600">Acceso total</span>
                                        ) : (
                                            <span className="text-xs font-semibold text-gray-600 tabular-nums">
                                                {permisosActivos(u.permissions)}
                                                <span className="text-gray-400"> / {ALL_MENU_KEYS.length}</span>
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <RowActionButton icon={Pencil} label="Editar" variant="edit" onClick={() => openEdit(u)} />
                                            <RowActionButton
                                                icon={Trash2}
                                                label={u.esUsuarioSistema ? 'Eliminar usuario' : 'Quitar acceso'}
                                                variant="delete"
                                                onClick={() => setDeleteTarget(u)}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </table>
                </div>
            </div>

            {/* Alta / edición */}
            <BaseModal
                isOpen={draft !== null}
                onClose={() => setDraft(null)}
                title={
                    isAdminDraft ? 'Administrador del proyecto'
                        : draft?.idEmpleado === null ? 'Nuevo usuario de sistema'
                            : 'Editar usuario'
                }
                subtitle={isAdminDraft
                    ? 'Sus datos viven en la cuenta central; sus permisos, en este proyecto'
                    : draft?.usuario && domain ? `${draft.usuario}@${domain}` : undefined}
                size="xl"
                footer={
                    <div className="flex items-center justify-end gap-2.5">
                        <Button variant="secondary" size="md" onClick={() => setDraft(null)} disabled={isSaving}>
                            Cancelar
                        </Button>
                        <Button variant="solid" size="md" leftIcon={Check} iconBox isLoading={isSaving} onClick={handleSave}>
                            Guardar
                        </Button>
                    </div>
                }
            >
                {draft && (
                    <div className="space-y-5">
                        {/* Datos de la cuenta del administrador (BD central) */}
                        {isAdminDraft && draft.adminIdUsuario !== null && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Input
                                        label="Nombre"
                                        value={draft.nombre}
                                        onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                                        placeholder="Nombre del administrador"
                                    />
                                    <Input
                                        label="Teléfono"
                                        value={draft.telefono}
                                        onChange={(e) => setDraft({ ...draft, telefono: e.target.value })}
                                        placeholder="10 dígitos"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Input
                                        label="Correo electrónico"
                                        type="email"
                                        value={draft.correo}
                                        onChange={(e) => setDraft({ ...draft, correo: e.target.value })}
                                        placeholder="admin@correo.com"
                                        hint="Es el correo con el que inicia sesión."
                                    />
                                    <Input
                                        label="Nueva contraseña"
                                        type="text"
                                        value={draft.password}
                                        onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                                        placeholder="Dejar vacío para no cambiarla"
                                        hint="Vacío conserva la actual."
                                    />
                                </div>
                                {draft.correo.trim().toLowerCase() !== (adminAccounts.find(a => a.idUsuario === draft.adminIdUsuario)?.correo || '').toLowerCase() && (
                                    <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                                        Estás cambiando el correo de acceso: la próxima vez tendrá que entrar con el
                                        nuevo. La contraseña no cambia salvo que la escribas arriba.
                                    </p>
                                )}
                            </div>
                        )}

                        {!isAdminDraft && (
                            <div className="space-y-3">
                                {/* En el alta se puede colgar el acceso de un empleado que ya existe */}
                                {draft.idEmpleado === null && sinAcceso.length > 0 && (
                                    <div className="w-full flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            ¿Es un empleado que ya existe?
                                        </label>
                                        <select
                                            value={draft.vinculaEmpleado ?? ''}
                                            onChange={(e) => {
                                                const id = e.target.value ? Number(e.target.value) : null;
                                                const emp = sinAcceso.find((x) => x.idEmpleado === id);
                                                setDraft({
                                                    ...draft,
                                                    vinculaEmpleado: id,
                                                    nombre: emp ? emp.nombre : '',
                                                    correo: emp?.correo || '',
                                                    esUsuarioSistema: id === null,
                                                });
                                            }}
                                            className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 bg-white focus:outline-none focus:border-blue-500 text-gray-800"
                                        >
                                            <option value="">No — es un usuario externo (contador, socio, soporte)</option>
                                            {sinAcceso.map((e) => (
                                                <option key={e.idEmpleado} value={e.idEmpleado}>{e.nombre}</option>
                                            ))}
                                        </select>
                                        <p className="text-[11px] text-gray-400">
                                            Si lo eliges, se le abre acceso al empleado y sigue apareciendo en nómina.
                                            Si no, se crea un usuario que solo entra al sistema.
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Input
                                        label="Nombre"
                                        value={draft.nombre}
                                        onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                                        placeholder="Ej. Laura Contadora"
                                        disabled={draft.vinculaEmpleado !== null}
                                    />
                                    <Input
                                        label="Correo de contacto"
                                        value={draft.correo}
                                        onChange={(e) => setDraft({ ...draft, correo: e.target.value })}
                                        placeholder="opcional"
                                        disabled={draft.vinculaEmpleado !== null}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="w-full flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            Usuario de acceso
                                        </label>
                                        <div className="flex items-stretch">
                                            <input
                                                type="text"
                                                value={draft.usuario}
                                                onChange={(e) => setDraft({ ...draft, usuario: e.target.value })}
                                                placeholder="laura"
                                                autoComplete="off"
                                                className="flex-1 min-w-0 text-sm rounded-l-lg border border-r-0 border-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500 text-gray-800"
                                            />
                                            <span className="inline-flex items-center px-3 rounded-r-lg border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500">
                                                @{domain || '…'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-400">Así entra al sistema: el dominio lo pone el proyecto.</p>
                                    </div>

                                    <Input
                                        label={draft.idEmpleado === null ? 'Contraseña' : 'Nueva contraseña'}
                                        type="text"
                                        value={draft.password}
                                        onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                                        placeholder={draft.idEmpleado === null ? 'Mínimo 4 caracteres' : 'Dejar vacío para no cambiarla'}
                                        hint={draft.idEmpleado !== null ? 'Vacío conserva la actual.' : undefined}
                                    />
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={draft.esAdministrador}
                                        onChange={(e) => setDraft({ ...draft, esAdministrador: e.target.checked })}
                                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-gray-300 cursor-pointer"
                                    />
                                    <span className="text-sm text-gray-700">
                                        Es administrador
                                        <span className="text-gray-400"> — ve todos los menús sin importar los permisos de abajo</span>
                                    </span>
                                </label>
                            </div>
                        )}

                        {/* Permisos de menú */}
                        <div className={`rounded-xl border border-gray-200 overflow-hidden ${draft.esAdministrador && !isAdminDraft ? 'opacity-50' : ''}`}>
                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                                    <KeyRound size={13} /> Permisos de menú
                                </span>
                                <span className="flex items-center gap-2">
                                    <button onClick={() => setAllPermissions(true)} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                                        Marcar todo
                                    </button>
                                    <span className="text-gray-300">·</span>
                                    <button onClick={() => setAllPermissions(false)} className="text-[11px] font-semibold text-gray-500 hover:text-gray-700">
                                        Limpiar
                                    </button>
                                </span>
                            </div>
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[46vh] overflow-y-auto">
                                {PERMISSION_MENU.map((section) => {
                                    const keys = section.items.map((i) => i.key);
                                    const todos = keys.every((k) => draft.permissions[k]);
                                    return (
                                        <div key={section.key} className="space-y-1.5">
                                            <button
                                                onClick={() => setSectionPermissions(keys, !todos)}
                                                className="w-full text-left text-[11px] font-black uppercase tracking-wider text-gray-500 hover:text-gray-800 flex items-center justify-between gap-2"
                                            >
                                                {section.label}
                                                <span className="text-[10px] font-semibold text-blue-600">
                                                    {todos ? 'Quitar' : 'Todos'}
                                                </span>
                                            </button>
                                            {section.items.map((item) => (
                                                <label key={item.key} className="flex items-center gap-2 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(draft.permissions[item.key])}
                                                        onChange={(e) => setPermission(item.key, e.target.checked)}
                                                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-gray-300 cursor-pointer"
                                                    />
                                                    <span className="text-[13px] text-gray-700">{item.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                            {isAdminDraft && (
                                <p className="px-4 py-2.5 bg-amber-50 border-t border-amber-100 text-[11px] text-amber-800">
                                    Si no marcas nada, el administrador conserva acceso total. En cuanto marques algo, solo verá lo
                                    marcado — Configuración General queda siempre habilitada para poder volver aquí.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </BaseModal>

            {/* Quitar acceso */}
            <BaseModal
                isOpen={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                title={deleteTarget?.esUsuarioSistema ? 'Eliminar usuario' : 'Quitar acceso'}
                subtitle={deleteTarget?.nombre}
                size="md"
                confirmVariant="danger"
                confirmLabel={deleteTarget?.esUsuarioSistema ? 'Eliminar' : 'Quitar acceso'}
                onConfirm={handleDelete}
            >
                <p className="text-sm text-gray-600">
                    {deleteTarget?.esUsuarioSistema
                        ? 'Este usuario existe solo para entrar al sistema, así que se elimina junto con sus permisos.'
                        : 'Se le retira el acceso al sistema, pero el empleado se conserva con toda su información y su nómina.'}
                </p>
            </BaseModal>
        </div>
    );
}

