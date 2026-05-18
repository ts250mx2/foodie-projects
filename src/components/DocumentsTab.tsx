'use client';

import { useState, useEffect, useRef } from 'react';
import { Trash2, Plus } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import Button from '@/components/Button';
import ThemedGridHeader, { ThemedGridHeaderCell, TableBody, TableRow, TableCell, RowActionButton } from '@/components/ThemedGridHeader';

interface Document {
    idProductoDocumento: number;
    descripcion: string;
    rutaArchivo: string | null;
    archivoDocumento: string | null;
    nombreArchivo: string | null;
}

interface DocumentsTabProps {
    product: {
        IdProducto: number;
        Producto: string;
    };
    projectId: number;
}

export default function DocumentsTab({ product, projectId }: DocumentsTabProps) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [newDescription, setNewDescription] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Generic file input ref for handling uploads from the grid
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingDocId, setUploadingDocId] = useState<number | null>(null);

    useEffect(() => {
        if (product) {
            fetchDocuments();
        }
    }, [product]);

    const fetchDocuments = async () => {
        try {
            const response = await fetch(`/api/products/${product.IdProducto}/documents?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setDocuments(data.data.map((item: any) => ({
                    idProductoDocumento: item.IdProductoDocumento,
                    descripcion: item.Descripcion,
                    rutaArchivo: item.RutaArchivo,
                    archivoDocumento: item.ArchivoDocumento,
                    nombreArchivo: item.NombreArchivo
                })));
            }
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = (docId: number) => {
        setUploadingDocId(docId);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && uploadingDocId !== null) {
            const file = e.target.files[0];
            await uploadFileForDocument(uploadingDocId, file);
        }
    };

    const uploadFileForDocument = async (docId: number, file: File) => {
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

            // Update document through API
            await updateDocument(docId, {
                archivoDocumento: base64Data,
                nombreArchivo: file.name,
                rutaArchivo: null // Clear old path
            });
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error al procesar el archivo');
        } finally {
            setIsUploading(false);
            setUploadingDocId(null);
        }
    };

    const updateDocument = async (docId: number, updates: Partial<Document>) => {
        // Optimistic update
        setDocuments(documents.map(d =>
            d.idProductoDocumento === docId ? { ...d, ...updates } : d
        ));

        try {
            const response = await fetch(`/api/products/${product.IdProducto}/documents`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    documentId: docId,
                    ...updates
                })
            });

            if (!response.ok) {
                await fetchDocuments(); // Revert on error
                alert('Error al actualizar el documento');
            }
        } catch (error) {
            console.error('Error updating document:', error);
            await fetchDocuments(); // Revert on error
            alert('Error al actualizar el documento');
        }
    };

    const handleAddDocument = async () => {
        if (!newDescription.trim()) {
            alert('Por favor ingrese una descripción');
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch(`/api/products/${product.IdProducto}/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    descripcion: newDescription,
                    rutaArchivo: null,
                    archivoDocumento: null,
                    nombreArchivo: null
                })
            });

            if (response.ok) {
                await fetchDocuments();
                setNewDescription('');
            } else {
                alert('Error al guardar el documento');
            }
        } catch (error) {
            console.error('Error adding document:', error);
            alert('Error al guardar el documento');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteDocument = async (idProductoDocumento: number) => {
        if (!confirm('¿Está seguro que desea eliminar este documento?')) return;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/products/${product.IdProducto}/documents?projectId=${projectId}&documentId=${idProductoDocumento}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchDocuments();
            } else {
                alert('Error al eliminar el documento');
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('Error al eliminar el documento');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDescriptionChange = (docId: number, newText: string) => {
        const newDocuments = documents.map(d =>
            d.idProductoDocumento === docId ? { ...d, descripcion: newText } : d
        );
        setDocuments(newDocuments);
    };

    const handleDescriptionBlur = (docId: number, newText: string) => {
        updateDocument(docId, { descripcion: newText });
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

            {/* Add Document Form */}
            <div className="px-6 py-4 border-b bg-white">
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-tight">
                        Descripción Documento
                    </label>
                    <div className="flex gap-3">
                        <textarea
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                            rows={2}
                            placeholder="Escriba la descripción del documento..."
                        />
                        <Button
                            onClick={handleAddDocument}
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
            </div>

            {/* Documents Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                    <LoadingSpinner message="Cargando..." size="md" />
                ) : documents.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        No hay documentos. Agregue el primer documento.
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full border-collapse">
                            <ThemedGridHeader>
                                <ThemedGridHeaderCell>Descripción</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell>Archivo</ThemedGridHeaderCell>
                                <ThemedGridHeaderCell align="center">Acciones</ThemedGridHeaderCell>
                            </ThemedGridHeader>
                            <TableBody
                                loading={false}
                                empty={documents.length === 0}
                                emptyMessage="No hay documentos"
                                colSpan={3}
                            >
                                {documents.map((document) => (
                                    <TableRow key={document.idProductoDocumento}>
                                        <TableCell>
                                            <textarea
                                                value={document.descripcion}
                                                onChange={(e) => handleDescriptionChange(document.idProductoDocumento, e.target.value)}
                                                onBlur={(e) => handleDescriptionBlur(document.idProductoDocumento, e.target.value)}
                                                className="w-full px-2 py-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded bg-transparent focus:bg-white resize-none h-auto overflow-hidden"
                                                rows={2}
                                                style={{ minHeight: '3rem' }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {(document.archivoDocumento || document.rutaArchivo) ? (
                                                    <>
                                                        <a
                                                            href={document.archivoDocumento
                                                                ? `/api/products/documents/download?projectId=${projectId}&productId=${product.IdProducto}&documentId=${document.idProductoDocumento}`
                                                                : document.rutaArchivo || '#'
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline text-xs flex items-center gap-1 max-w-[120px] truncate"
                                                            title={document.nombreArchivo || 'Ver archivo'}
                                                        >
                                                            📎 {document.nombreArchivo ? (document.nombreArchivo.length > 15 ? document.nombreArchivo.substring(0, 12) + '...' : document.nombreArchivo) : 'Ver'}
                                                        </a>
                                                        <button
                                                            onClick={() => handleFileSelect(document.idProductoDocumento)}
                                                            className="text-gray-500 hover:text-blue-600 text-xs border rounded px-2 py-1"
                                                            disabled={isUploading}
                                                        >
                                                            🔄 Cambiar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleFileSelect(document.idProductoDocumento)}
                                                        className="text-green-600 hover:text-green-800 text-xs border border-green-200 bg-green-50 rounded px-2 py-1 flex items-center gap-1"
                                                        disabled={isUploading}
                                                    >
                                                        📤 Subir Archivo
                                                    </button>
                                                )}
                                                {isUploading && uploadingDocId === document.idProductoDocumento && (
                                                    <span className="text-xs text-blue-500 animate-pulse">...</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell align="center">
                                            <RowActionButton
                                                icon={Trash2}
                                                label="Eliminar"
                                                variant="delete"
                                                onClick={() => handleDeleteDocument(document.idProductoDocumento)}
                                            />
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
