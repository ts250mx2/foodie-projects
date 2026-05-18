'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, Smartphone } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import Button from '@/components/Button';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';
import QRCode from 'react-qr-code';
import CryptoJS from 'crypto-js';

const SECRET_KEY = 'foodie-instructions-secret';

interface Instruction {
    numeroPaso: number;
    instrucciones: string;
    rutaArchivo: string | null;
    archivoDocumento: string | null;
    nombreArchivo: string | null;
}

interface InstructionsTabProps {
    product: {
        IdProducto: number;
        Producto: string;
    };
    projectId: number;
}

export default function InstructionsTab({ product, projectId }: InstructionsTabProps) {
    const [instructions, setInstructions] = useState<Instruction[]>([]);
    const [newInstruction, setNewInstruction] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Generic file input ref for handling uploads from the grid
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingStep, setUploadingStep] = useState<number | null>(null);

    // QR Code Modal
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);
    const [mobileUrl, setMobileUrl] = useState('');

    useEffect(() => {
        try {
            const dataString = JSON.stringify({
                p: projectId,
                i: product.IdProducto
            });
            const encrypted = CryptoJS.AES.encrypt(dataString, SECRET_KEY).toString();
            const token = encodeURIComponent(encrypted);
            setMobileUrl(`${window.location.origin}/es/mobile/instructions?q=${token}`);
        } catch (error) {
            console.error('Error encoding URL params', error);
            setMobileUrl(`${window.location.origin}/es/mobile/instructions?projectId=${projectId}&productId=${product.IdProducto}`);
        }
    }, [projectId, product.IdProducto]);

    useEffect(() => {
        if (product) {
            fetchInstructions();
        }
    }, [product]);

    const fetchInstructions = async () => {
        try {
            const response = await fetch(`/api/products/${product.IdProducto}/instructions?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setInstructions(data.data.map((item: any) => ({
                    numeroPaso: item.NumeroPaso,
                    instrucciones: item.Instrucciones,
                    rutaArchivo: item.RutaArchivo,
                    archivoDocumento: item.ArchivoDocumento,
                    nombreArchivo: item.NombreArchivo
                })));
            }
        } catch (error) {
            console.error('Error fetching instructions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = (numeroPaso: number) => {
        setUploadingStep(numeroPaso);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && uploadingStep !== null) {
            const file = e.target.files[0];
            await uploadFileForStep(uploadingStep, file);
        }
    };

    const uploadFileForStep = async (step: number, file: File) => {
        setIsUploading(true);
        try {
            // Convert file to Base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const base64String = (reader.result as string).split(',')[1];
                    resolve(base64String);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const base64Data = await base64Promise;

            // Update instructions with new file data
            const newInstructions = instructions.map(i =>
                i.numeroPaso === step ? {
                    ...i,
                    archivoDocumento: base64Data,
                    nombreArchivo: file.name,
                    rutaArchivo: null // Clear old path
                } : i
            );

            // Save updated list to DB
            await saveInstructions(newInstructions);
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error al procesar el archivo');
        } finally {
            setIsUploading(false);
            setUploadingStep(null);
        }
    };

    const saveInstructions = async (updatedInstructions: Instruction[]) => {
        // Optimistic update
        setInstructions(updatedInstructions);

        try {
            const response = await fetch(`/api/products/${product.IdProducto}/instructions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    instructions: updatedInstructions.map(i => ({
                        instrucciones: i.instrucciones,
                        rutaArchivo: i.rutaArchivo,
                        archivoDocumento: i.archivoDocumento,
                        nombreArchivo: i.nombreArchivo
                    }))
                })
            });

            if (!response.ok) {
                // Revert on failure
                await fetchInstructions();
                alert('Error al guardar los cambios');
            }
        } catch (error) {
            console.error('Error saving instructions:', error);
            await fetchInstructions();
            alert('Error al guardar los cambios');
        }
    };

    const handleAddInstruction = async () => {
        if (!newInstruction.trim()) {
            alert('Por favor ingrese una instrucción');
            return;
        }

        setIsSaving(true);
        try {
            const newInstructionObj = {
                instrucciones: newInstruction,
                rutaArchivo: null,
                archivoDocumento: null,
                nombreArchivo: null
            };

            const response = await fetch(`/api/products/${product.IdProducto}/instructions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    instructions: [
                        ...instructions.map(i => ({
                            instrucciones: i.instrucciones,
                            rutaArchivo: i.rutaArchivo,
                            archivoDocumento: i.archivoDocumento,
                            nombreArchivo: i.nombreArchivo
                        })),
                        newInstructionObj
                    ]
                })
            });

            if (response.ok) {
                await fetchInstructions();
                setNewInstruction('');
            } else {
                alert('Error al guardar la instrucción');
            }
        } catch (error) {
            console.error('Error adding instruction:', error);
            alert('Error al guardar la instrucción');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteInstruction = async (numeroPaso: number) => {
        if (!confirm('¿Está seguro que desea eliminar este paso?')) return;

        setIsSaving(true);
        try {
            const filtered = instructions.filter(i => i.numeroPaso !== numeroPaso);
            await saveInstructions(filtered);
        } catch (error) {
            console.error('Error deleting instruction:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleMoveUp = async (numeroPaso: number) => {
        if (numeroPaso === 1) return;

        setIsSaving(true);
        try {
            const newInstructions = [...instructions];
            const currentIndex = numeroPaso - 1;
            const previousIndex = currentIndex - 1;

            [newInstructions[currentIndex], newInstructions[previousIndex]] =
                [newInstructions[previousIndex], newInstructions[currentIndex]];

            await saveInstructions(newInstructions);
        } catch (error) {
            console.error('Error moving instruction up:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleMoveDown = async (numeroPaso: number) => {
        if (numeroPaso === instructions.length) return;

        setIsSaving(true);
        try {
            const newInstructions = [...instructions];
            const currentIndex = numeroPaso - 1;
            const nextIndex = currentIndex + 1;

            [newInstructions[currentIndex], newInstructions[nextIndex]] =
                [newInstructions[nextIndex], newInstructions[currentIndex]];

            await saveInstructions(newInstructions);
        } catch (error) {
            console.error('Error moving instruction down:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleInstructionChange = (numeroPaso: number, newText: string) => {
        const newInstructions = instructions.map(i =>
            i.numeroPaso === numeroPaso ? { ...i, instrucciones: newText } : i
        );
        setInstructions(newInstructions);
    };

    const handleInstructionBlur = () => {
        saveInstructions(instructions);
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Hidden generic file input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
            />

            {/* QR Modal */}
            {isQRModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="bg-primary-600 p-4 text-center relative">
                            <button
                                onClick={() => setIsQRModalOpen(false)}
                                className="absolute top-4 right-4 text-white/70 hover:text-white"
                            >
                                ✕
                            </button>
                            <h3 className="text-white font-bold text-lg">Escanear con el Móvil</h3>
                        </div>
                        <div className="p-8 flex flex-col items-center justify-center space-y-6">
                            <p className="text-gray-500 text-sm text-center">
                                Escanea este código con tu teléfono para agregar instrucciones y grabar videos directamente desde tu cámara.
                            </p>
                            <div className="bg-white p-4 rounded-xl shadow-inner border border-gray-100">
                                <QRCode value={mobileUrl} size={200} />
                            </div>
                            <a
                                href={mobileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-xs"
                            >
                                Abrir enlace directo
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Instruction Form */}
            <div className="px-6 py-4 border-b bg-white space-y-3">
                <label className="block text-sm font-bold text-gray-700 uppercase tracking-tight">
                    Nueva Instrucción
                </label>
                <div className="flex gap-3">
                    <textarea
                        value={newInstruction}
                        onChange={(e) => setNewInstruction(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                        rows={2}
                        placeholder="Escriba la instrucción del paso..."
                    />
                </div>
                <div className="flex gap-3 justify-end">
                    <Button
                        onClick={() => setIsQRModalOpen(true)}
                        variant="secondary"
                        size="md"
                        leftIcon={Smartphone}
                        iconBox
                    >
                        Modo Móvil
                    </Button>
                    <Button
                        onClick={handleAddInstruction}
                        disabled={isSaving}
                        variant="solid"
                        size="md"
                        leftIcon={Plus}
                        iconBox
                        isLoading={isSaving}
                    >
                        Agregar
                    </Button>
                </div>
            </div>

            {/* Instructions Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                    <LoadingSpinner message="Cargando..." size="md" />
                ) : instructions.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        No hay instrucciones. Agregue el primer paso.
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full border-collapse">
                            <ThemedGridHeader>
                                <ThemedGridHeaderCell align="center">Paso</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>Instrucción</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>Archivo</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="center">Acciones</ThemedGridHeaderCell>
                            </ThemedGridHeader>
                            <TableBody
                                loading={false}
                                empty={instructions.length === 0}
                                emptyMessage="No hay instrucciones"
                                colSpan={4}
                            >
                                {instructions.map((instruction) => (
                                    <TableRow key={instruction.numeroPaso}>
                                        <TableCell align="center" className="font-bold text-blue-600 w-16">
                                            {instruction.numeroPaso}
                                        </TableCell>
                                        <TableCell>
                                            <textarea
                                                value={instruction.instrucciones}
                                                onChange={(e) => handleInstructionChange(instruction.numeroPaso, e.target.value)}
                                                onBlur={handleInstructionBlur}
                                                className="w-full px-2 py-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded bg-transparent focus:bg-white resize-none h-auto overflow-hidden"
                                                rows={2}
                                                style={{ minHeight: '3rem' }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {(instruction.archivoDocumento || instruction.rutaArchivo) ? (
                                                    <>
                                                        <a
                                                            href={instruction.archivoDocumento
                                                                ? `/api/products/instructions/download?projectId=${projectId}&productId=${product.IdProducto}&stepNumber=${instruction.numeroPaso}`
                                                                : instruction.rutaArchivo || '#'
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline text-xs flex items-center gap-1 max-w-[120px] truncate"
                                                            title={instruction.nombreArchivo || 'Ver archivo'}
                                                        >
                                                            📎 {instruction.nombreArchivo ? (instruction.nombreArchivo.length > 15 ? instruction.nombreArchivo.substring(0, 12) + '...' : instruction.nombreArchivo) : 'Ver'}
                                                        </a>
                                                        <button
                                                            onClick={() => handleFileSelect(instruction.numeroPaso)}
                                                            className="text-gray-500 hover:text-blue-600 text-xs border rounded px-2 py-1"
                                                            disabled={isUploading}
                                                        >
                                                            🔄 Cambiar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleFileSelect(instruction.numeroPaso)}
                                                        className="text-green-600 hover:text-green-800 text-xs border border-green-200 bg-green-50 rounded px-2 py-1 flex items-center gap-1"
                                                        disabled={isUploading}
                                                    >
                                                        📤 Subir Archivo
                                                    </button>
                                                )}
                                                {isUploading && uploadingStep === instruction.numeroPaso && (
                                                    <span className="text-xs text-blue-500 animate-pulse">...</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell align="center">
                                            <div className="flex justify-center gap-1">
                                                <button
                                                    onClick={() => handleMoveUp(instruction.numeroPaso)}
                                                    disabled={instruction.numeroPaso === 1}
                                                    className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="Subir"
                                                >
                                                    <ArrowUp size={16} className="text-gray-600" />
                                                </button>
                                                <button
                                                    onClick={() => handleMoveDown(instruction.numeroPaso)}
                                                    disabled={instruction.numeroPaso === instructions.length}
                                                    className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="Bajar"
                                                >
                                                    <ArrowDown size={16} className="text-gray-600" />
                                                </button>
                                                <RowActionButton
                                                    icon={Trash2}
                                                    label="Eliminar"
                                                    variant="delete"
                                                    onClick={() => handleDeleteInstruction(instruction.numeroPaso)}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
