'use client';

import { useState, useEffect, useRef } from 'react';
import Button from './Button';
import Input from './Input';

interface Document {
    IdSucursalDocumento: number;
    Documento: string;
    Comentarios: string | null;
    RutaArchivo: string;
    ArchivoDocumento?: string | null;
    NombreArchivo?: string | null;
    FechaAct: string;
}

interface BranchDocumentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId: number;
    branchName: string;
    projectId: number;
}

export default function BranchDocumentsModal({ isOpen, onClose, branchId, branchName, projectId }: BranchDocumentsModalProps) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        documentName: '',
        comments: ''
    });

    // Grid upload state
    const [isUploading, setIsUploading] = useState(false);
    const [uploadingDocId, setUploadingDocId] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && branchId) {
            fetchDocuments();
        }
    }, [isOpen, branchId]);

    const fetchDocuments = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/branches/${branchId}/documents?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setDocuments(data.data);
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && uploadingDocId !== null) {
            uploadFileForDocument(uploadingDocId, e.target.files[0]);
        }
    };

    const uploadFileForDocument = async (docId: number, file: File) => {
        setIsUploading(true);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            try {
                const response = await fetch(`/api/branches/${branchId}/documents`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId,
                        documentId: docId,
                        fileBase64: base64,
                        fileName: file.name
                    })
                });

                if (response.ok) {
                    fetchDocuments();
                } else {
                    alert('Error al subir el archivo');
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                alert('Error al subir el archivo');
            } finally {
                setIsUploading(false);
                setUploadingDocId(null);
            }
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.documentName) return;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/branches/${branchId}/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    documentName: formData.documentName,
                    comments: formData.comments,
                    fileBase64: null // No file on create
                })
            });

            if (response.ok) {
                setFormData({ documentName: '', comments: '' });
                fetchDocuments();
            }
        } catch (error) {
            console.error('Error saving document:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (docId: number) => {
        if (!confirm('¿Estás seguro de eliminar este documento?')) return;
        try {
            const response = await fetch(`/api/branches/${branchId}/documents?projectId=${projectId}&docId=${docId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                fetchDocuments();
            }
        } catch (error) {
            console.error('Error deleting document:', error);
        }
    };

    const handleDownload = (doc: Document) => {
        if (doc.ArchivoDocumento) {
            // Assume PDF or generic binary for now
            const link = document.createElement('a');
            link.href = `data:application/octet-stream;base64,${doc.ArchivoDocumento}`;
            link.download = doc.NombreArchivo || doc.Documento; // Prefer Original Filename
            link.click();
        } else if (doc.RutaArchivo) {
            window.open(doc.RutaArchivo, '_blank');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                />

                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Documentos - {branchName}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
                    {/* Add Form */}
                    <div className="md:col-span-1 border-r pr-6 border-gray-100">
                        <h3 className="text-sm font-bold text-orange-600 mb-4 uppercase">Nuevo Documento</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label="Nombre del Documento"
                                value={formData.documentName}
                                onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
                                required
                                placeholder="Ej: Licencia de Funcionamiento"
                            />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label>
                                <textarea
                                    value={formData.comments}
                                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    rows={3}
                                    placeholder="Comentarios adicionales..."
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isSaving}>
                                {isSaving ? 'Guardando...' : 'Agregar Documento'}
                            </Button>
                        </form>
                    </div>

                    {/* Documents List */}
                    <div className="md:col-span-2 overflow-y-auto pr-2">
                        <h3 className="text-sm font-bold text-gray-600 mb-4 uppercase">Historial</h3>
                        {isLoading ? (
                            <div className="text-center py-10 text-gray-500">Cargando documentos...</div>
                        ) : documents.length === 0 ? (
                            <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg">No hay documentos registrados.</div>
                        ) : (
                            <div className="bg-white rounded border border-gray-100 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Documento</th>
                                            <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Comentarios</th>
                                            <th className="px-4 py-2 text-center text-[10px] font-bold text-gray-500 uppercase">Archivo</th>
                                            <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {documents.map((doc) => (
                                            <tr key={doc.IdSucursalDocumento} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-xs font-semibold text-gray-900 truncate max-w-[150px]" title={doc.Documento}>
                                                    {doc.Documento}
                                                </td>
                                                <td className="px-4 py-3 text-[11px] text-gray-600 truncate max-w-[150px]" title={doc.Comentarios || ''}>
                                                    {doc.Comentarios || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {(doc.ArchivoDocumento || doc.RutaArchivo) ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => handleDownload(doc)}
                                                                className="text-blue-600 hover:underline text-[10px] flex items-center gap-1"
                                                            >
                                                                📎 Ver
                                                            </button>
                                                            <button
                                                                onClick={() => handleFileSelect(doc.IdSucursalDocumento)}
                                                                className="text-gray-400 hover:text-blue-600 text-[10px] border rounded px-1"
                                                                disabled={isUploading}
                                                            >
                                                                🔄
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleFileSelect(doc.IdSucursalDocumento)}
                                                            className="text-green-600 hover:text-green-800 text-[10px] border border-green-200 bg-green-50 rounded px-2 py-1"
                                                            disabled={isUploading}
                                                        >
                                                            📤 Subir
                                                        </button>
                                                    )}
                                                    {isUploading && uploadingDocId === doc.IdSucursalDocumento && (
                                                        <span className="text-[10px] text-blue-500 animate-pulse block">Subiendo...</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => handleDelete(doc.IdSucursalDocumento)}
                                                        className="text-lg hover:scale-125 transition-transform text-red-500"
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

                <div className="flex justify-end mt-6 pt-4 border-t">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-medium"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
